"""LangGraph 主图。

状态机结构：

    START
      │
      ▼
   [Triage]
      │
      ▼
   <should_skip?>
   ├─ True  → END (打 skipped 标签)
   └─ False ↓
   [Diagnosis]
      │
      ▼
   [Action]
      │
      ▼
    END

后续可扩展：在 Diagnosis 后加 <confidence?> 路由：
- 高置信度 → Action（直执行）
- 低置信度 → human_review（人工介入）
"""
from langgraph.graph import StateGraph, START, END
from orchestrator.state import MaintenanceState
from agents.triage import triage_node
from agents.diagnosis import diagnosis_node
from agents.action import action_node


def _route_after_triage(state: MaintenanceState) -> str:
    """Triage 后的路由：噪声直接结束，否则进诊断。"""
    if state.get("should_skip"):
        return "skip"
    return "continue"


def _skip_node(state: MaintenanceState) -> dict:
    """噪声事件的终止节点。"""
    print("\n========== [SKIP] 判定为噪声，跳过处理 ==========")
    return {
        "final_status": "skipped",
        "trace": ["[Skip] 告警被判定为噪声，未创建工单"],
    }


def build_graph():
    """构建并编译 LangGraph。"""
    graph = StateGraph(MaintenanceState)

    # 注册节点
    graph.add_node("triage", triage_node)
    graph.add_node("diagnosis", diagnosis_node)
    graph.add_node("action", action_node)
    graph.add_node("skip", _skip_node)

    # 入口
    graph.add_edge(START, "triage")

    # Triage 后的条件分支
    graph.add_conditional_edges(
        "triage",
        _route_after_triage,
        {
            "continue": "diagnosis",
            "skip": "skip",
        },
    )

    # 主链路
    graph.add_edge("diagnosis", "action")
    graph.add_edge("action", END)
    graph.add_edge("skip", END)

    return graph.compile()
