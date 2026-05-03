"""主入口：跑一次完整的 Triage → Diagnosis → Action 流程。

用法：
    python main.py                          # 用默认 sample_alerts.json
    python main.py path/to/your_alerts.json # 自定义告警文件
"""
import json
import sys
from pathlib import Path
from orchestrator.graph import build_graph
from orchestrator.state import MaintenanceState


def load_alerts(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    # 解析参数
    if len(sys.argv) > 1:
        alerts_path = sys.argv[1]
    else:
        alerts_path = Path(__file__).parent / "fixtures" / "sample_alerts.json"

    print(f"加载告警: {alerts_path}")
    alerts = load_alerts(str(alerts_path))
    print(f"共 {len(alerts)} 条")

    # 构图
    graph = build_graph()

    # 初始状态
    initial_state: MaintenanceState = {
        "raw_alerts": alerts,
        "triage": None,
        "diagnosis": None,
        "action": None,
        "trace": [],
        "should_skip": False,
        "final_status": None,
    }

    # 跑图
    final_state = graph.invoke(initial_state)

    # 打印结果
    print("\n" + "=" * 60)
    print("最终结果")
    print("=" * 60)
    print(f"状态: {final_state.get('final_status')}")
    print(f"\n推理 trace:")
    for line in final_state.get("trace", []):
        print(f"  {line}")

    if final_state.get("action"):
        action = final_state["action"]
        print(f"\n工单: {action['ticket_id']}")
        print(f"动作数: {len(action['actions_taken'])}")


if __name__ == "__main__":
    main()
