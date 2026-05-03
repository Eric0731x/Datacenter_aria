"""单元测试 + 端到端集成测试。

分两类：
  - 离线测试（无需 API Key）：图结构、状态 schema、mock LLM 节点行为
  - 集成测试（需要 MOONSHOT_API_KEY）：真实 LLM 的端到端流程
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from orchestrator.graph import build_graph
from orchestrator.state import MaintenanceState


# ── 辅助 ──────────────────────────────────────────────────────────

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


# ============================================================
# 离线单元测试（始终运行，不需要 API Key）
# ============================================================

class TestGraphStructure:
    """验证 LangGraph 图的结构是否符合预期。"""

    def test_graph_compiles(self):
        """build_graph() 应无异常返回编译后的图。"""
        g = build_graph()
        assert g is not None

    def test_graph_has_expected_nodes(self):
        """图必须包含 triage / diagnosis / action / skip 四个节点。"""
        g = build_graph()
        node_names = set(g.nodes.keys())
        for expected in ("triage", "diagnosis", "action", "skip"):
            assert expected in node_names, f"缺少节点: {expected}"

    def test_graph_state_fields(self):
        """MaintenanceState 必须包含所有预期字段。"""
        from orchestrator.state import MaintenanceState
        required_keys = {
            "raw_alerts", "triage", "diagnosis", "action",
            "trace", "should_skip", "final_status",
        }
        annotations = MaintenanceState.__annotations__
        assert required_keys.issubset(annotations.keys()), (
            f"MaintenanceState 缺少字段: {required_keys - annotations.keys()}"
        )


class TestInitialState:
    """验证初始状态构造和字段约束。"""

    def test_trace_starts_empty(self):
        state = _initial_state([])
        assert state["trace"] == []

    def test_should_skip_defaults_false(self):
        state = _initial_state([])
        assert state["should_skip"] is False

    def test_agents_start_none(self):
        state = _initial_state([])
        for key in ("triage", "diagnosis", "action"):
            assert state[key] is None, f"{key} 初始值应为 None"

    def test_initial_final_status_none(self):
        state = _initial_state([])
        assert state["final_status"] is None


class TestSkipRouting:
    """验证噪声路由逻辑（不依赖真实 LLM）。"""

    def test_skip_node_sets_final_status(self):
        """直接调用 _skip_node，验证它正确写入 final_status。"""
        from orchestrator.graph import _skip_node
        result = _skip_node({})
        assert result["final_status"] == "skipped"
        assert result["trace"] != []

    def test_route_after_triage_noise(self):
        """should_skip=True 时路由到 skip。"""
        from orchestrator.graph import _route_after_triage
        assert _route_after_triage({"should_skip": True}) == "skip"

    def test_route_after_triage_continue(self):
        """should_skip=False 时路由到 continue。"""
        from orchestrator.graph import _route_after_triage
        assert _route_after_triage({"should_skip": False}) == "continue"


class TestMockLLMNodes:
    """用 mock LLM 验证各节点的输出格式和状态更新。"""

    _TRIAGE_JSON = json.dumps({
        "incident_id": "INC-ABCDEF",
        "aggregated_alerts": ["A-001"],
        "priority": "P1",
        "summary": "测试事件",
        "is_noise": False,
    })

    _DIAGNOSIS_JSON = json.dumps({
        "root_cause": "风扇故障导致 CPU 过热",
        "confidence": 0.88,
        "affected_components": ["fan", "cpu"],
        "similar_cases": [],
        "recommended_sop": "fan_failure",
        "reasoning": "IPMI 传感器显示 FAN1 转速为 0，同时 CPU 温度超过阈值，两路证据交叉验证。",
    })

    _ACTION_JSON = json.dumps({
        "actions_taken": [],
        "requires_approval": False,
        "ticket_id": "OPS-123456",
        "status": "completed",
    })

    @pytest.fixture
    def mock_triage_llm(self):
        resp = MagicMock()
        resp.content = self._TRIAGE_JSON
        llm = MagicMock()
        llm.invoke.return_value = resp
        return llm

    @pytest.fixture
    def mock_diagnosis_llm(self):
        resp = MagicMock()
        resp.content = self._DIAGNOSIS_JSON
        resp.tool_calls = []
        llm = MagicMock()
        llm.invoke.return_value = resp
        llm.bind_tools.return_value = llm
        return llm

    @pytest.fixture
    def mock_action_llm(self):
        resp = MagicMock()
        resp.content = self._ACTION_JSON
        resp.tool_calls = []
        llm = MagicMock()
        llm.invoke.return_value = resp
        llm.bind_tools.return_value = llm
        return llm

    def test_triage_node_output_fields(self, mock_triage_llm):
        """triage_node 应写入 triage / should_skip / trace 三个字段。"""
        from agents.triage import triage_node
        alert = {
            "alert_id": "A-001", "host": "srv-001", "rack": "A01",
            "severity": "critical", "source": "ipmi",
            "message": "Fan RPM 0", "timestamp": "2026-01-01T00:00:00Z", "raw": {},
        }
        state = _initial_state([alert])
        with patch("agents.triage.get_kimi_llm", return_value=mock_triage_llm):
            result = triage_node(state)
        assert "triage" in result
        assert "should_skip" in result
        assert "trace" in result
        assert result["triage"]["incident_id"] == "INC-ABCDEF"
        assert result["should_skip"] is False

    def test_triage_node_noise_sets_skip(self, mock_triage_llm):
        """当 LLM 输出 is_noise=True 时，should_skip 应为 True。"""
        from agents.triage import triage_node
        noise_json = json.dumps({
            "incident_id": "INC-NOISE1",
            "aggregated_alerts": ["A-001"],
            "priority": "P3",
            "summary": "心跳超时自愈",
            "is_noise": True,
        })
        mock_triage_llm.invoke.return_value.content = noise_json
        alert = {
            "alert_id": "A-001", "host": "srv-001", "rack": "A01",
            "severity": "info", "source": "zabbix",
            "message": "Heartbeat timeout", "timestamp": "2026-01-01T00:00:00Z",
            "raw": {"recovered": True},
        }
        with patch("agents.triage.get_kimi_llm", return_value=mock_triage_llm):
            result = triage_node(_initial_state([alert]))
        assert result["should_skip"] is True

    def test_triage_node_json_fallback(self):
        """LLM 返回非 JSON 时，triage_node 应降级处理而不抛异常。"""
        from agents.triage import triage_node
        bad_resp = MagicMock()
        bad_resp.content = "抱歉，我无法处理该请求。"
        bad_llm = MagicMock()
        bad_llm.invoke.return_value = bad_resp
        alert = {
            "alert_id": "A-001", "host": "srv-001", "rack": "A01",
            "severity": "warning", "source": "zabbix",
            "message": "test", "timestamp": "2026-01-01T00:00:00Z", "raw": {},
        }
        with patch("agents.triage.get_kimi_llm", return_value=bad_llm):
            result = triage_node(_initial_state([alert]))
        # 降级后应该有合法的 triage 字段
        assert result["triage"]["priority"] == "P2"
        assert result["triage"]["is_noise"] is False

    def test_diagnosis_node_output_fields(self, mock_diagnosis_llm):
        """diagnosis_node 应写入 diagnosis / trace 两个字段。"""
        from agents.diagnosis import diagnosis_node
        state = {
            **_initial_state([{
                "alert_id": "A-001", "host": "srv-001", "rack": "A01",
                "severity": "critical", "source": "ipmi",
                "message": "Fan RPM 0", "timestamp": "2026-01-01T00:00:00Z", "raw": {},
            }]),
            "triage": {
                "incident_id": "INC-ABCDEF",
                "aggregated_alerts": ["A-001"],
                "priority": "P1",
                "summary": "风扇故障",
                "is_noise": False,
            },
        }
        with patch("agents.diagnosis.get_kimi_llm", return_value=mock_diagnosis_llm):
            result = diagnosis_node(state)
        assert "diagnosis" in result
        assert "trace" in result
        diag = result["diagnosis"]
        assert diag["root_cause"] != ""
        assert 0.0 <= diag["confidence"] <= 1.0
        assert isinstance(diag["affected_components"], list)

    def test_action_node_output_fields(self, mock_action_llm):
        """action_node 应写入 action / trace / final_status 三个字段。"""
        from agents.action import action_node
        state = {
            **_initial_state([{
                "alert_id": "A-001", "host": "srv-001", "rack": "A01",
                "severity": "critical", "source": "ipmi",
                "message": "Fan RPM 0", "timestamp": "2026-01-01T00:00:00Z", "raw": {},
            }]),
            "triage": {
                "incident_id": "INC-ABCDEF",
                "aggregated_alerts": ["A-001"],
                "priority": "P1",
                "summary": "风扇故障",
                "is_noise": False,
            },
            "diagnosis": {
                "root_cause": "风扇故障",
                "confidence": 0.88,
                "affected_components": ["fan"],
                "similar_cases": [],
                "recommended_sop": "fan_failure",
                "reasoning": "IPMI 传感器显示 FAN1 转速为 0。",
            },
        }
        with patch("agents.action.get_kimi_llm", return_value=mock_action_llm):
            result = action_node(state)
        assert "action" in result
        assert "trace" in result
        assert "final_status" in result
        assert result["action"]["status"] in ("completed", "pending_approval", "failed")

    def test_trace_accumulates(self, mock_triage_llm, mock_diagnosis_llm, mock_action_llm):
        """trace 字段在各节点执行后应累加，而非覆盖。"""
        from agents.triage import triage_node
        from agents.diagnosis import diagnosis_node
        from agents.action import action_node

        alert = {
            "alert_id": "A-001", "host": "srv-001", "rack": "A01",
            "severity": "critical", "source": "ipmi",
            "message": "Fan RPM 0", "timestamp": "2026-01-01T00:00:00Z", "raw": {},
        }
        state = _initial_state([alert])

        with patch("agents.triage.get_kimi_llm", return_value=mock_triage_llm):
            t_result = triage_node(state)
        state = {**state, **t_result, "trace": state["trace"] + t_result["trace"]}

        with patch("agents.diagnosis.get_kimi_llm", return_value=mock_diagnosis_llm):
            d_result = diagnosis_node(state)
        state = {**state, **d_result, "trace": state["trace"] + d_result["trace"]}

        with patch("agents.action.get_kimi_llm", return_value=mock_action_llm):
            a_result = action_node(state)
        final_trace = state["trace"] + a_result["trace"]

        assert len(final_trace) >= 3, "trace 应包含至少三个节点的记录"


class TestMockTools:
    """验证 mock 工具的返回格式。"""

    def test_smart_query_returns_json(self):
        from tools.mock_tools import smart_query
        result = smart_query.invoke({"host": "test-srv", "device": "/dev/sda"})
        parsed = json.loads(result)
        assert "health" in parsed
        assert "reallocated_sectors" in parsed

    def test_jira_create_ticket_returns_id(self):
        from tools.mock_tools import jira_create_ticket
        result = jira_create_ticket.invoke({
            "title": "测试工单",
            "description": "自动化测试",
            "priority": "P2",
        })
        parsed = json.loads(result)
        assert parsed["ticket_id"].startswith("OPS-")
        assert "url" in parsed

    def test_search_sop_known_keyword(self):
        from tools.mock_tools import search_sop
        result = search_sop.invoke({"keyword": "fan_failure"})
        parsed = json.loads(result)
        assert "sop_id" in parsed
        assert "risk_level" in parsed
        assert parsed["risk_level"] in ("low", "high")

    def test_search_sop_unknown_keyword(self):
        from tools.mock_tools import search_sop
        result = search_sop.invoke({"keyword": "nonexistent_sop"})
        parsed = json.loads(result)
        assert "error" in parsed

    def test_ansible_dry_run(self):
        from tools.mock_tools import ansible_run_playbook
        result = ansible_run_playbook.invoke({
            "host": "test-srv", "playbook": "test.yml", "dry_run": True
        })
        assert "DRY RUN" in result

    def test_search_similar_incidents_returns_list(self):
        from tools.mock_tools import search_similar_incidents
        result = search_similar_incidents.invoke({"query": "风扇故障", "top_k": 2})
        parsed = json.loads(result)
        assert isinstance(parsed, list)
        assert len(parsed) <= 2
        for item in parsed:
            assert "case_id" in item
            assert "similarity" in item


# ============================================================
# 集成测试（需要 MOONSHOT_API_KEY）
# ============================================================

requires_api = pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="未设置 RUN_INTEGRATION_TESTS=1，跳过集成测试（运行：RUN_INTEGRATION_TESTS=1 pytest -m integration）",
)



@pytest.fixture(scope="module")
def live_graph():
    return build_graph()


@pytest.fixture
def fan_failure_alerts():
    fixtures_path = Path(__file__).parent.parent / "fixtures" / "sample_alerts.json"
    return json.loads(fixtures_path.read_text(encoding="utf-8"))


@requires_api
def test_full_flow_fan_failure(live_graph, fan_failure_alerts):
    """完整流程：风扇故障应走完三个 Agent，工单必须创建。"""
    state = live_graph.invoke(_initial_state(fan_failure_alerts))

    assert state["triage"] is not None
    assert not state["triage"]["is_noise"]
    assert state["triage"]["priority"] in ("P0", "P1", "P2")

    assert state["diagnosis"] is not None
    assert state["diagnosis"]["confidence"] > 0
    rc_lower = state["diagnosis"]["root_cause"].lower()
    assert any(kw in rc_lower for kw in ["风扇", "fan", "温度", "temperature", "热", "thermal"])

    assert state["action"] is not None
    assert state["action"]["ticket_id"] is not None
    assert state["action"]["status"] in ("completed", "pending_approval")


@requires_api
def test_noise_alert_skipped(live_graph):
    """噪声告警：心跳超时 + 已自愈，不进入 Diagnosis 和 Action。"""
    noise = [{
        "alert_id": "A-NOISE-001",
        "host": "test-srv-001",
        "rack": "B01",
        "severity": "info",
        "source": "zabbix",
        "message": "Heartbeat timeout (auto-recovered in 12s)",
        "timestamp": "2026-05-04T02:00:00Z",
        "raw": {"recovered": True, "duration_sec": 12},
    }]
    state = live_graph.invoke(_initial_state(noise))

    assert state["triage"]["is_noise"] is True
    assert state["final_status"] == "skipped"
    assert state["diagnosis"] is None
    assert state["action"] is None


@requires_api
def test_high_risk_requires_approval(live_graph):
    """P0 多机过热应触发 requires_approval=True，不得自动执行 ansible。"""
    alerts = [
        {
            "alert_id": "A-P0-001",
            "host": f"rack-b03-srv-{i:03d}",
            "rack": "B03",
            "severity": "critical",
            "source": "ipmi",
            "message": f"CPU0 temperature {88 + i}C exceeds critical threshold 85C",
            "timestamp": "2026-05-04T11:20:00Z",
            "raw": {"sensor": "CPU0_Temp", "value": 88 + i, "threshold": 85},
        }
        for i in range(3)
    ] + [{
        "alert_id": "A-P0-004",
        "host": "rack-b03-srv-005",
        "rack": "B03",
        "severity": "critical",
        "source": "zabbix",
        "message": "Rack B03 inlet temperature 42C - possible CRAC failure",
        "timestamp": "2026-05-04T11:20:15Z",
        "raw": {"metric": "rack.inlet_temp", "value": 42},
    }]

    state = live_graph.invoke(_initial_state(alerts))
    assert state["triage"]["priority"] == "P0"
    assert state["action"]["requires_approval"] is True

    # 验证高风险未被误执行
    for a in state["action"].get("actions_taken", []):
        if a.get("tool") == "ansible_run_playbook":
            assert a.get("args", {}).get("dry_run", True), \
                "高风险案例中 ansible 不得以 dry_run=False 执行"


@requires_api
def test_trace_records_all_agents(live_graph, fan_failure_alerts):
    """trace 字段应包含来自 Triage、Diagnosis、Action 三个节点的记录。"""
    state = live_graph.invoke(_initial_state(fan_failure_alerts))
    trace = state.get("trace", [])
    assert any("[Triage]" in t for t in trace), "trace 缺少 Triage 记录"
    assert any("[Diagnosis]" in t for t in trace), "trace 缺少 Diagnosis 记录"
    assert any("[Action]" in t for t in trace), "trace 缺少 Action 记录"
