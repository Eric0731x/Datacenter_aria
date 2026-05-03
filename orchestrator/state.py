"""共享状态定义。

LangGraph 的核心理念：所有 Agent 通过修改同一个状态对象协作，
而不是用消息传递。这样调试时可以直接 dump 整个状态，看清楚每一步发生了什么。
"""
from typing import Annotated, Literal, TypedDict
from operator import add


class Alert(TypedDict):
    """单条原始告警。"""
    alert_id: str
    host: str
    rack: str
    severity: Literal["info", "warning", "critical"]
    source: str  # zabbix / ipmi / smart / syslog
    message: str
    timestamp: str
    raw: dict  # 原始数据


class TriageResult(TypedDict):
    """Triage Agent 输出。"""
    incident_id: str
    aggregated_alerts: list[str]  # alert_id 列表
    priority: Literal["P0", "P1", "P2", "P3"]
    summary: str  # 一句话描述
    is_noise: bool  # 是否被判定为噪声


class DiagnosisResult(TypedDict):
    """Diagnosis Agent 输出。"""
    root_cause: str
    confidence: float  # 0~1
    affected_components: list[str]  # ["disk", "raid_controller", ...]
    similar_cases: list[str]  # 历史相似案例 ID
    recommended_sop: str  # SOP 文件名
    reasoning: str  # 推理过程，用于审计


class ActionResult(TypedDict):
    """Action Agent 输出。"""
    actions_taken: list[dict]  # [{"tool": "ipmi", "args": {...}, "result": "..."}]
    requires_approval: bool
    ticket_id: str | None
    status: Literal["completed", "pending_approval", "failed"]


class MaintenanceState(TypedDict):
    """图的全局状态。

    Annotated[list, add] 表示这个字段会被累加，而不是覆盖。
    便于多个 Agent 往同一个列表里写日志。
    """
    # 输入
    raw_alerts: list[Alert]

    # 各 Agent 的产出
    triage: TriageResult | None
    diagnosis: DiagnosisResult | None
    action: ActionResult | None

    # 推理日志（每个节点都往里写）
    trace: Annotated[list[str], add]

    # 控制流
    should_skip: bool  # Triage 判定为噪声时置 True
    final_status: Literal["success", "skipped", "error", "pending"] | None
