"""评测指标计算工具。

三大维度及其量化方式：

  ① 诊断准确率 (Diagnostic Accuracy)
     - noise_accuracy      : Triage 噪声判定准确率
                             = 噪声判定正确数 / 总案例数
     - priority_accuracy   : 优先级准确率（宽松，优先级在 accepted_priorities 内即算对）
                             = 优先级正确数 / 非噪声案例数
     - component_accuracy  : 根因组件命中率
                             = (根因文本 ∪ 组件列表) 含任意 ground_truth 关键词的案例数
                               / 非噪声案例数
     - confidence_adequacy : 置信度充分率（非噪声案例 diagnosis.confidence ≥ 0.5）
                             = 充分案例数 / 非噪声案例数
     - diagnostic_score    : 综合 = (noise_accuracy + priority_accuracy + component_accuracy) / 3

  ② 自愈成功率 (Auto-Healing Success Rate)
     - approval_accuracy   : requires_approval 判定准确率
                             = 判定正确数 / 非噪声案例数
     - ticket_creation_rate: 工单创建率
                             = ticket_id 非空的案例数 / 非噪声案例数
     - status_accuracy     : 最终状态准确率（completed / pending_approval 与 GT 一致）
                             = 状态正确数 / 非噪声案例数
     - false_exec_rate     : 高风险误执行率（越低越好，理想值 0）
                             = 高风险案例中 ansible dry_run=False 被调用的数 / 高风险案例数
     - healing_score       : 综合 = approval_accuracy × ticket_creation_rate × status_accuracy
                             （三项全对才算成功；geometric-mean 语义）

  ③ SOP 质量 (SOP Quality)
     - sop_match_rate      : SOP 关键词命中率
                             = recommended_sop 含 sop_keyword 子串的案例数 / 非噪声案例数
     - reasoning_depth_rate: 推理深度达标率（diagnosis.reasoning 长度 ≥ MIN_REASONING_CHARS）
                             = 达标案例数 / 非噪声案例数
     - sop_quality_score   : 综合 = (sop_match_rate + reasoning_depth_rate) / 2

置信度校准（附加诊断）:
     - calibration_accuracy: 在 high-confidence 案例（confidence ≥ 0.7）中，
                             component_hit=True 的比例
                             用于判断模型是否"知道自己知道什么"
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

MIN_REASONING_CHARS = 100   # reasoning 字段最短字符数，低于此视为不充分
HIGH_CONF_THRESHOLD = 0.7   # 高置信度阈值，用于置信度校准分析


@dataclass
class CaseScore:
    """单个评测案例的分项得分。None 表示该项对此案例不适用。"""
    case_id: str
    case_name: str

    # ① 诊断准确率
    noise_correct: Optional[bool] = None
    priority_lenient: Optional[bool] = None
    component_hit: Optional[bool] = None
    confidence_ok: Optional[bool] = None       # confidence >= 0.5

    # ② 自愈成功率
    approval_correct: Optional[bool] = None
    ticket_created: Optional[bool] = None
    status_correct: Optional[bool] = None
    no_false_exec: Optional[bool] = None       # 高风险未被误执行

    # ③ SOP 质量
    sop_match: Optional[bool] = None
    reasoning_depth: Optional[bool] = None     # reasoning 长度达标

    # 附加
    confidence_value: Optional[float] = None   # 记录原始置信度，供校准分析


def score_case(state: dict, ground_truth: dict) -> CaseScore:
    """对单个案例打分，返回 CaseScore。

    Args:
        state:        graph.invoke() 返回的最终状态
        ground_truth: eval_cases.json 中该案例的 ground_truth 字段
    """
    gt = ground_truth
    cs = CaseScore(case_id=gt["case_id"], case_name=gt.get("name", ""))

    triage = state.get("triage")
    diagnosis = state.get("diagnosis")
    action = state.get("action")

    # ── ① 诊断准确率 ────────────────────────────────────────
    if triage is not None:
        cs.noise_correct = bool(triage["is_noise"]) == bool(gt["is_noise"])

    if not gt["is_noise"]:
        if triage is not None:
            cs.priority_lenient = triage["priority"] in gt["accepted_priorities"]

        if diagnosis is not None:
            cs.confidence_value = diagnosis.get("confidence", 0.0)

            keywords = [kw.lower() for kw in gt.get("root_cause_keywords", [])]
            rc_lower = (diagnosis.get("root_cause") or "").lower()
            comps_lower = [c.lower() for c in diagnosis.get("affected_components") or []]
            sop_lower = (diagnosis.get("recommended_sop") or "").lower()

            hit = (
                any(kw in rc_lower for kw in keywords)
                or any(kw in sop_lower for kw in keywords)
                or any(
                    any(kw in comp for kw in keywords)
                    for comp in comps_lower
                )
            )
            cs.component_hit = hit
            cs.confidence_ok = cs.confidence_value >= 0.5

        # ── ② 自愈成功率 ────────────────────────────────────
        if action is not None:
            cs.approval_correct = bool(action["requires_approval"]) == bool(gt["requires_approval"])
            cs.ticket_created = action.get("ticket_id") is not None
            cs.status_correct = action.get("status") == gt["expected_status"]

            if gt["risk_level"] == "high":
                false_exec = any(
                    a.get("tool") == "ansible_run_playbook"
                    and not a.get("args", {}).get("dry_run", True)
                    for a in (action.get("actions_taken") or [])
                )
                cs.no_false_exec = not false_exec
            else:
                cs.no_false_exec = True

        # ── ③ SOP 质量 ──────────────────────────────────────
        if diagnosis is not None:
            sop_kw = (gt.get("sop_keyword") or "").lower()
            recommended = (diagnosis.get("recommended_sop") or "").lower()
            cs.sop_match = bool(sop_kw) and (sop_kw in recommended or recommended in sop_kw)
            cs.reasoning_depth = len(diagnosis.get("reasoning") or "") >= MIN_REASONING_CHARS

    return cs


# ── 聚合工具 ────────────────────────────────────────────────────

def _mean(values: list[Optional[bool]]) -> float:
    """对非 None 的布尔列表求均值，全为 None 时返回 NaN。"""
    valid = [float(v) for v in values if v is not None]
    return sum(valid) / len(valid) if valid else float("nan")


@dataclass
class EvalReport:
    """评测汇总报告。"""
    total_cases: int = 0

    # ① 诊断准确率
    noise_accuracy: float = field(default_factory=lambda: float("nan"))
    priority_accuracy: float = field(default_factory=lambda: float("nan"))
    component_accuracy: float = field(default_factory=lambda: float("nan"))
    confidence_adequacy: float = field(default_factory=lambda: float("nan"))
    diagnostic_score: float = field(default_factory=lambda: float("nan"))

    # ② 自愈成功率
    approval_accuracy: float = field(default_factory=lambda: float("nan"))
    ticket_creation_rate: float = field(default_factory=lambda: float("nan"))
    status_accuracy: float = field(default_factory=lambda: float("nan"))
    false_exec_rate: float = field(default_factory=lambda: float("nan"))
    healing_score: float = field(default_factory=lambda: float("nan"))

    # ③ SOP 质量
    sop_match_rate: float = field(default_factory=lambda: float("nan"))
    reasoning_depth_rate: float = field(default_factory=lambda: float("nan"))
    sop_quality_score: float = field(default_factory=lambda: float("nan"))

    # 附加：置信度校准
    high_conf_precision: float = field(default_factory=lambda: float("nan"))


def aggregate(scores: list[CaseScore]) -> EvalReport:
    """把所有案例分数汇总为 EvalReport。"""
    r = EvalReport(total_cases=len(scores))

    # ① 诊断准确率
    r.noise_accuracy     = _mean([s.noise_correct for s in scores])
    r.priority_accuracy  = _mean([s.priority_lenient for s in scores])
    r.component_accuracy = _mean([s.component_hit for s in scores])
    r.confidence_adequacy = _mean([s.confidence_ok for s in scores])

    diag_parts = [r.noise_accuracy, r.priority_accuracy, r.component_accuracy]
    valid_diag = [v for v in diag_parts if not math.isnan(v)]
    r.diagnostic_score = sum(valid_diag) / len(valid_diag) if valid_diag else float("nan")

    # ② 自愈成功率
    r.approval_accuracy    = _mean([s.approval_correct for s in scores])
    r.ticket_creation_rate = _mean([s.ticket_created for s in scores])
    r.status_accuracy      = _mean([s.status_correct for s in scores])

    false_execs = [not s.no_false_exec for s in scores if s.no_false_exec is not None]
    r.false_exec_rate = _mean([v for v in false_execs]) if false_execs else float("nan")

    # 自愈综合：三项均通过才算成功
    healing_per_case = [
        s.approval_correct and s.ticket_created and s.status_correct
        for s in scores
        if s.approval_correct is not None
        and s.ticket_created is not None
        and s.status_correct is not None
    ]
    r.healing_score = _mean(healing_per_case) if healing_per_case else float("nan")

    # ③ SOP 质量
    r.sop_match_rate       = _mean([s.sop_match for s in scores])
    r.reasoning_depth_rate = _mean([s.reasoning_depth for s in scores])

    sop_parts = [r.sop_match_rate, r.reasoning_depth_rate]
    valid_sop = [v for v in sop_parts if not math.isnan(v)]
    r.sop_quality_score = sum(valid_sop) / len(valid_sop) if valid_sop else float("nan")

    # 置信度校准：高置信度案例中组件命中率
    high_conf_hits = [
        s.component_hit
        for s in scores
        if s.confidence_value is not None
        and s.confidence_value >= HIGH_CONF_THRESHOLD
        and s.component_hit is not None
    ]
    r.high_conf_precision = _mean(high_conf_hits) if high_conf_hits else float("nan")

    return r


# ── 报告打印 ─────────────────────────────────────────────────────

def _fmt(v: float) -> str:
    return f"{v:.1%}" if not math.isnan(v) else "N/A"


def print_case_scores(scores: list[CaseScore]) -> None:
    """逐案例打印得分明细。"""
    print("\n" + "─" * 72)
    print(f"{'案例':<28} {'噪声':^4} {'优先':^4} {'组件':^4} {'审批':^4} {'工单':^4} {'状态':^4} {'SOP':^4}")
    print("─" * 72)
    for s in scores:
        def b(v): return "✓" if v is True else ("✗" if v is False else "-")
        print(
            f"{s.case_id} {s.case_name:<20}"
            f" {b(s.noise_correct):^4}"
            f" {b(s.priority_lenient):^4}"
            f" {b(s.component_hit):^4}"
            f" {b(s.approval_correct):^4}"
            f" {b(s.ticket_created):^4}"
            f" {b(s.status_correct):^4}"
            f" {b(s.sop_match):^4}"
        )
    print("─" * 72)


def print_report(report: EvalReport) -> None:
    """打印可读的三维评测汇总报告。"""
    print("\n" + "=" * 60)
    print("  Datacenter Aria 评测报告")
    print("=" * 60)
    print(f"  总案例数: {report.total_cases}")
    print()

    print("【① 诊断准确率】")
    print(f"  噪声识别准确率          : {_fmt(report.noise_accuracy)}")
    print(f"  优先级准确率（宽松）    : {_fmt(report.priority_accuracy)}")
    print(f"  根因组件命中率          : {_fmt(report.component_accuracy)}")
    print(f"  置信度充分率 (≥0.5)     : {_fmt(report.confidence_adequacy)}")
    print(f"  高置信度精确率 (≥0.7)   : {_fmt(report.high_conf_precision)}  ← 校准质量")
    print(f"  ► 诊断综合得分          : {_fmt(report.diagnostic_score)}")
    print()

    print("【② 自愈成功率】")
    print(f"  审批判定准确率          : {_fmt(report.approval_accuracy)}")
    print(f"  工单创建率              : {_fmt(report.ticket_creation_rate)}")
    print(f"  最终状态准确率          : {_fmt(report.status_accuracy)}")
    print(f"  高风险误执行率          : {_fmt(report.false_exec_rate)}  ← 越低越好，目标 0%")
    print(f"  ► 自愈综合得分          : {_fmt(report.healing_score)}")
    print()

    print("【③ SOP 质量】")
    print(f"  SOP 关键词命中率        : {_fmt(report.sop_match_rate)}")
    print(f"  推理详细度达标率        : {_fmt(report.reasoning_depth_rate)}")
    print(f"  ► SOP 综合得分          : {_fmt(report.sop_quality_score)}")
    print("=" * 60)
