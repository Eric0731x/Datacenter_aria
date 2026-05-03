"""Triage Agent：告警分诊。

职责：
1. 把同一根因的多条告警聚合成一个 incident
2. 识别已知噪声（夜间例行重启、心跳抖动等）
3. 判定优先级 P0~P3

设计选择：
- 用 instant 模式（thinking 关闭），低延迟
- 不调工具，纯文本推理（输入是结构化告警 JSON）
- 输出强制 JSON schema
"""
import json
import uuid
from langchain_core.messages import SystemMessage, HumanMessage
from orchestrator.llm import get_kimi_llm
from orchestrator.state import MaintenanceState, TriageResult


SYSTEM_PROMPT = """你是数据中心告警分诊专家。你需要分析一批原始告警，把它们合并为一个事件（incident），并判定是否值得告警。

判定规则：
- P0：核心业务受影响 / 多机宕机 / 数据丢失风险
- P1：单机故障 / 性能严重劣化
- P2：硬件预警 / 性能轻微劣化
- P3：信息性事件 / 可观测但不紧急

噪声判定（is_noise=true）：
- 已知的例行抖动（夜间备份、定时任务）
- 单条心跳超时但 30s 内自愈
- 同主机重复 5 次以上的相同告警（属于已知未修复问题）

输出严格 JSON，不要包含其他解释文字：
{
  "incident_id": "INC-<6位hex>",
  "aggregated_alerts": ["alert_id1", "alert_id2"],
  "priority": "P0" | "P1" | "P2" | "P3",
  "summary": "一句话描述这个事件",
  "is_noise": true | false
}"""


def triage_node(state: MaintenanceState) -> dict:
    """Triage 节点。

    输入：state["raw_alerts"]
    输出：更新 state["triage"] 和 state["should_skip"]
    """
    print("\n========== [TRIAGE] 开始分诊 ==========")

    alerts = state["raw_alerts"]
    print(f"  收到 {len(alerts)} 条原始告警")

    # 把告警序列化喂给 LLM
    user_msg = f"""请分析以下 {len(alerts)} 条告警，判断是否构成一个事件，并按 schema 输出 JSON：

{json.dumps(alerts, ensure_ascii=False, indent=2)}

请输出 JSON。"""

    llm = get_kimi_llm(mode="instant")
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ])

    # 解析 JSON（容错处理）
    raw_output = response.content.strip()
    # 去除可能的 ```json 包裹
    if raw_output.startswith("```"):
        raw_output = raw_output.split("```")[1]
        if raw_output.startswith("json"):
            raw_output = raw_output[4:]
    raw_output = raw_output.strip().rstrip("```").strip()

    try:
        parsed = json.loads(raw_output)
    except json.JSONDecodeError as e:
        print(f"  [WARN] LLM 输出不是合法 JSON，降级处理: {e}")
        # 降级：保守地认为是 P2 普通事件
        parsed = {
            "incident_id": f"INC-{uuid.uuid4().hex[:6].upper()}",
            "aggregated_alerts": [a["alert_id"] for a in alerts],
            "priority": "P2",
            "summary": "Triage 解析失败，降级保守处理",
            "is_noise": False,
        }

    triage_result: TriageResult = {
        "incident_id": parsed["incident_id"],
        "aggregated_alerts": parsed["aggregated_alerts"],
        "priority": parsed["priority"],
        "summary": parsed["summary"],
        "is_noise": parsed["is_noise"],
    }

    print(f"  事件 ID: {triage_result['incident_id']}")
    print(f"  优先级: {triage_result['priority']}")
    print(f"  摘要: {triage_result['summary']}")
    print(f"  是否噪声: {triage_result['is_noise']}")

    return {
        "triage": triage_result,
        "should_skip": triage_result["is_noise"],
        "trace": [f"[Triage] {triage_result['priority']} - {triage_result['summary']}"],
    }
