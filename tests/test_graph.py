"""端到端测试。

注意：这些测试会实际调用 Kimi K2.6 API，需要设置 MOONSHOT_API_KEY。
也可以通过 mock LLM 跑离线测试，这里先用真实 API 验证集成。
"""
import json
import os
from pathlib import Path
import pytest

from orchestrator.graph import build_graph
from orchestrator.state import MaintenanceState


pytestmark = pytest.mark.skipif(
    not os.getenv("MOONSHOT_API_KEY"),
    reason="未设置 MOONSHOT_API_KEY，跳过真实 API 测试",
)


@pytest.fixture
def graph():
    return build_graph()


@pytest.fixture
def fan_failure_alerts():
    """Dell 服务器风扇故障导致 CPU 过热的告警样本。"""
    fixtures_path = Path(__file__).parent.parent / "fixtures" / "sample_alerts.json"
    return json.loads(fixtures_path.read_text(encoding="utf-8"))


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


def test_full_flow_fan_failure(graph, fan_failure_alerts):
    """完整流程：风扇故障应被识别为高优先级，走完三个 Agent。"""
    state = graph.invoke(_initial_state(fan_failure_alerts))

    # Triage 应判定为非噪声、高优先级
    assert state["triage"] is not None
    assert not state["triage"]["is_noise"]
    assert state["triage"]["priority"] in ("P0", "P1", "P2")

    # Diagnosis 应给出风扇/温度相关的根因
    assert state["diagnosis"] is not None
    assert state["diagnosis"]["confidence"] > 0
    rc_lower = state["diagnosis"]["root_cause"].lower()
    assert any(kw in rc_lower for kw in ["风扇", "fan", "温度", "temperature", "热", "thermal"])

    # Action 应至少创建了工单
    assert state["action"] is not None
    assert state["action"]["ticket_id"] is not None
    assert state["action"]["status"] in ("completed", "pending_approval")


def test_noise_alert_skipped(graph):
    """噪声告警：单条心跳超时 + 已自愈，应被跳过。"""
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
    state = graph.invoke(_initial_state(noise))

    # 应被 Triage 标记为噪声
    assert state["triage"]["is_noise"] is True
    assert state["final_status"] == "skipped"

    # 不应进入 Diagnosis 和 Action
    assert state["diagnosis"] is None
    assert state["action"] is None
