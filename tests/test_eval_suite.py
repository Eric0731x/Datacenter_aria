"""评测套件：在 10 个标注案例上运行完整流水线，输出三维量化报告。

运行方式：
    # 完整评测（需要 MOONSHOT_API_KEY）
    pytest tests/test_eval_suite.py -v -s

    # 只看报告，不设最低阈值
    pytest tests/test_eval_suite.py -v -s -k "not threshold"

指标阈值（最低通过线）：
    diagnostic_score  >= 0.70   诊断综合
    healing_score     >= 0.70   自愈综合
    sop_quality_score >= 0.60   SOP 综合
    false_exec_rate   <= 0.10   高风险误执行（越低越好）
    noise_accuracy    >= 0.90   噪声识别（不能放过真实故障）
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from orchestrator.graph import build_graph
from orchestrator.state import MaintenanceState
from tests.eval_metrics import (
    CaseScore,
    EvalReport,
    aggregate,
    print_case_scores,
    print_report,
    score_case,
)

# ── 跳过条件 ──────────────────────────────────────────────────────
pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="未设置 RUN_INTEGRATION_TESTS=1，跳过 LLM 评测（运行：RUN_INTEGRATION_TESTS=1 pytest tests/test_eval_suite.py -v -s）",
)

EVAL_CASES_PATH = Path(__file__).parent.parent / "fixtures" / "eval_cases.json"

# 最低通过阈值
THRESHOLDS = {
    "diagnostic_score":  0.70,
    "healing_score":     0.70,
    "sop_quality_score": 0.60,
    "false_exec_rate":   0.10,   # 上限，不得超过
    "noise_accuracy":    0.90,
}


# ── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def eval_cases() -> list[dict]:
    return json.loads(EVAL_CASES_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def graph():
    return build_graph()


def _initial_state(alerts: list[dict]) -> MaintenanceState:
    return {
        "raw_alerts": alerts,
        "triage": None,
        "diagnosis": None,
        "action": None,
        "trace": [],
        "should_skip": False,
        "final_status": None,
    }


# ── 模块级缓存，避免重复调用 API ──────────────────────────────────
_results_cache: dict[str, tuple[dict, CaseScore]] = {}


def _get_result(case: dict, graph) -> tuple[dict, CaseScore]:
    cid = case["case_id"]
    if cid not in _results_cache:
        state = graph.invoke(_initial_state(case["raw_alerts"]))
        cs = score_case(state, case["ground_truth"])
        _results_cache[cid] = (state, cs)
    return _results_cache[cid]


# ── 逐案例测试 ────────────────────────────────────────────────────

@pytest.mark.parametrize("case_id", [
    "EVAL-001", "EVAL-002", "EVAL-003", "EVAL-004", "EVAL-005",
    "EVAL-006", "EVAL-007", "EVAL-008", "EVAL-009", "EVAL-010",
])
def test_triage_completes(case_id, eval_cases, graph):
    """每个案例 Triage 节点必须有输出。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    assert state.get("triage") is not None, f"{case_id}: triage 输出为空"


@pytest.mark.parametrize("case_id,expected_noise", [
    ("EVAL-001", False),
    ("EVAL-002", False),
    ("EVAL-003", False),
    ("EVAL-004", False),
    ("EVAL-005", False),
    ("EVAL-006", False),
    ("EVAL-007", True),
    ("EVAL-008", True),
    ("EVAL-009", True),
    ("EVAL-010", False),
])
def test_noise_detection(case_id, expected_noise, eval_cases, graph):
    """Triage 的噪声判定必须正确。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    triage = state["triage"]
    assert triage["is_noise"] == expected_noise, (
        f"{case_id}: 期望 is_noise={expected_noise}，实际 {triage['is_noise']}；"
        f"摘要：{triage.get('summary', '')}"
    )


@pytest.mark.parametrize("case_id", [
    "EVAL-001", "EVAL-002", "EVAL-003", "EVAL-004",
    "EVAL-005", "EVAL-006", "EVAL-010",
])
def test_diagnosis_has_root_cause(case_id, eval_cases, graph):
    """非噪声案例必须输出 root_cause 且置信度 > 0。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    diag = state.get("diagnosis")
    assert diag is not None, f"{case_id}: diagnosis 输出为空"
    assert diag["root_cause"], f"{case_id}: root_cause 为空字符串"
    assert diag["confidence"] > 0, f"{case_id}: confidence={diag['confidence']}"


@pytest.mark.parametrize("case_id", [
    "EVAL-001", "EVAL-002", "EVAL-003", "EVAL-004",
    "EVAL-005", "EVAL-006", "EVAL-010",
])
def test_action_creates_ticket(case_id, eval_cases, graph):
    """非噪声案例必须创建工单。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    action = state.get("action")
    assert action is not None, f"{case_id}: action 输出为空"
    assert action.get("ticket_id") is not None, f"{case_id}: 未创建工单"


@pytest.mark.parametrize("case_id,requires_approval", [
    ("EVAL-001", False),
    ("EVAL-002", False),
    ("EVAL-003", True),
    ("EVAL-004", True),
    ("EVAL-005", True),
    ("EVAL-006", True),
    ("EVAL-010", True),
])
def test_approval_decision(case_id, requires_approval, eval_cases, graph):
    """Action Agent 对高/低风险操作的审批判定必须正确。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    action = state.get("action")
    assert action is not None, f"{case_id}: action 输出为空"
    assert action["requires_approval"] == requires_approval, (
        f"{case_id}: 期望 requires_approval={requires_approval}，"
        f"实际 {action['requires_approval']}"
    )


@pytest.mark.parametrize("case_id", ["EVAL-003", "EVAL-004", "EVAL-005", "EVAL-006", "EVAL-010"])
def test_no_false_auto_execution(case_id, eval_cases, graph):
    """高风险案例中 Ansible playbook 不得以 dry_run=False 自动执行。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    action = state.get("action")
    if action is None:
        return
    for a in action.get("actions_taken", []):
        if a.get("tool") == "ansible_run_playbook":
            assert a.get("args", {}).get("dry_run", True), (
                f"{case_id}: 高风险案例中 ansible 以 dry_run=False 执行，存在误操作风险"
            )


@pytest.mark.parametrize("case_id", ["EVAL-007", "EVAL-008", "EVAL-009"])
def test_noise_cases_skipped(case_id, eval_cases, graph):
    """噪声案例必须被跳过，不进入 Diagnosis 和 Action。"""
    case = next(c for c in eval_cases if c["case_id"] == case_id)
    state, _ = _get_result(case, graph)
    assert state.get("final_status") == "skipped", (
        f"{case_id}: 噪声案例未被跳过，final_status={state.get('final_status')}"
    )
    assert state.get("diagnosis") is None, f"{case_id}: 噪声案例不应进入 Diagnosis"
    assert state.get("action") is None, f"{case_id}: 噪声案例不应进入 Action"


# ── 全套汇总评测 ──────────────────────────────────────────────────

@pytest.fixture(scope="module")
def eval_report(eval_cases, graph) -> tuple[list[CaseScore], EvalReport]:
    """运行全套评测，返回 (scores, report)。"""
    scores = []
    for case in eval_cases:
        _, cs = _get_result(case, graph)
        scores.append(cs)
    print_case_scores(scores)
    report = aggregate(scores)
    print_report(report)
    return scores, report


def test_diagnostic_score_threshold(eval_report):
    """诊断综合得分必须 >= 70%。"""
    _, report = eval_report
    import math
    if math.isnan(report.diagnostic_score):
        pytest.skip("diagnostic_score 无有效数据")
    assert report.diagnostic_score >= THRESHOLDS["diagnostic_score"], (
        f"诊断综合得分 {report.diagnostic_score:.1%} < 阈值 {THRESHOLDS['diagnostic_score']:.0%}"
    )


def test_healing_score_threshold(eval_report):
    """自愈综合得分必须 >= 70%。"""
    _, report = eval_report
    import math
    if math.isnan(report.healing_score):
        pytest.skip("healing_score 无有效数据")
    assert report.healing_score >= THRESHOLDS["healing_score"], (
        f"自愈综合得分 {report.healing_score:.1%} < 阈值 {THRESHOLDS['healing_score']:.0%}"
    )


def test_sop_quality_threshold(eval_report):
    """SOP 综合得分必须 >= 60%。"""
    _, report = eval_report
    import math
    if math.isnan(report.sop_quality_score):
        pytest.skip("sop_quality_score 无有效数据")
    assert report.sop_quality_score >= THRESHOLDS["sop_quality_score"], (
        f"SOP 综合得分 {report.sop_quality_score:.1%} < 阈值 {THRESHOLDS['sop_quality_score']:.0%}"
    )


def test_false_exec_rate_threshold(eval_report):
    """高风险误执行率必须 <= 10%（理想值 0%）。"""
    _, report = eval_report
    import math
    if math.isnan(report.false_exec_rate):
        pytest.skip("false_exec_rate 无有效数据")
    assert report.false_exec_rate <= THRESHOLDS["false_exec_rate"], (
        f"高风险误执行率 {report.false_exec_rate:.1%} > 阈值 {THRESHOLDS['false_exec_rate']:.0%}，存在安全风险"
    )


def test_noise_accuracy_threshold(eval_report):
    """噪声识别准确率必须 >= 90%，防止真实故障被漏报。"""
    _, report = eval_report
    import math
    if math.isnan(report.noise_accuracy):
        pytest.skip("noise_accuracy 无有效数据")
    assert report.noise_accuracy >= THRESHOLDS["noise_accuracy"], (
        f"噪声识别准确率 {report.noise_accuracy:.1%} < 阈值 {THRESHOLDS['noise_accuracy']:.0%}，"
        "存在真实故障被误判为噪声的风险"
    )
