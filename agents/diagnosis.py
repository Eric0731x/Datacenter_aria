"""Diagnosis Agent：根因诊断。

职责：
1. 拿到 Triage 输出的 incident，调用工具收集证据
2. 检索历史相似案例（RAG）
3. 给出根因、置信度、推荐 SOP

设计选择：
- 用 thinking 模式，开启深度推理
- 工具调用循环：让模型自主决定调几次工具，最多 5 轮
- 输出包含 reasoning 字段，便于审计
"""
import json
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, AIMessage
from orchestrator.llm import get_kimi_llm
from orchestrator.state import MaintenanceState, DiagnosisResult
from tools.mock_tools import DIAGNOSIS_TOOLS


SYSTEM_PROMPT = """你是资深数据中心硬件诊断专家，有 15 年服务器维护经验。

你的工作流程：
1. 阅读 incident 摘要，明确要诊断什么
2. 调用工具收集证据：IPMI 传感器数据、SEL 日志、SMART 信息等
3. 检索历史相似案例，看是否有现成的处理经验
4. 综合所有证据，给出根因判断

诊断原则：
- 先看 IPMI/SEL 这种最直接的硬件证据
- 单点证据不下结论，至少两路证据交叉验证
- 历史案例只做参考，不能盲信（机型、批次可能不同）
- 拿不准就给低置信度（0.3~0.6），让人类介入

完成所有调查后，输出严格 JSON（不要 markdown 包裹）：
{
  "root_cause": "简洁的根因描述",
  "confidence": 0.0~1.0 之间的浮点数,
  "affected_components": ["disk", "fan", ...],
  "similar_cases": ["INC-xxx"],
  "recommended_sop": "fan_failure" 之类的 SOP 关键词,
  "reasoning": "你的完整推理链路"
}"""

MAX_TOOL_LOOPS = 5


def diagnosis_node(state: MaintenanceState) -> dict:
    """Diagnosis 节点。"""
    print("\n========== [DIAGNOSIS] 开始诊断 ==========")

    triage = state["triage"]
    raw_alerts = state["raw_alerts"]

    # 拿到主要受影响的主机
    main_host = raw_alerts[0]["host"] if raw_alerts else "unknown"

    user_msg = f"""请诊断以下事件的根因：

事件 ID: {triage['incident_id']}
优先级: {triage['priority']}
摘要: {triage['summary']}
主要受影响主机: {main_host}

原始告警:
{json.dumps(raw_alerts, ensure_ascii=False, indent=2)}

请通过工具调查，给出诊断结论。"""

    llm = get_kimi_llm(mode="thinking", temperature=0.3)
    llm_with_tools = llm.bind_tools(DIAGNOSIS_TOOLS)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ]

    # 工具调用循环
    tool_map = {t.name: t for t in DIAGNOSIS_TOOLS}
    final_content = None

    for loop in range(MAX_TOOL_LOOPS):
        response = llm_with_tools.invoke(messages)
        messages.append(response)

        # 没有工具调用 → 模型给出最终答案
        if not response.tool_calls:
            final_content = response.content
            print(f"  Loop {loop+1}: 模型给出最终答案")
            break

        print(f"  Loop {loop+1}: 模型请求 {len(response.tool_calls)} 次工具调用")

        # 执行工具
        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            if tool_name not in tool_map:
                tool_result = f"ERROR: 未知工具 {tool_name}"
            else:
                tool_result = tool_map[tool_name].invoke(tool_args)
            messages.append(ToolMessage(
                content=str(tool_result),
                tool_call_id=tc["id"],
            ))
    else:
        print(f"  [WARN] 达到 {MAX_TOOL_LOOPS} 轮工具调用上限，强制收尾")
        # 强制让模型出结论
        messages.append(HumanMessage(content="请基于已有信息直接给出 JSON 诊断结论，不要再调用工具。"))
        final_response = llm.invoke(messages)
        final_content = final_response.content

    # 解析 JSON
    if final_content is None:
        final_content = "{}"

    raw = final_content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip().rstrip("```").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print(f"  [WARN] 诊断输出非 JSON，降级")
        parsed = {
            "root_cause": "诊断 LLM 输出解析失败",
            "confidence": 0.0,
            "affected_components": [],
            "similar_cases": [],
            "recommended_sop": "",
            "reasoning": final_content,
        }

    diagnosis: DiagnosisResult = {
        "root_cause": parsed.get("root_cause", ""),
        "confidence": float(parsed.get("confidence", 0.0)),
        "affected_components": parsed.get("affected_components", []),
        "similar_cases": parsed.get("similar_cases", []),
        "recommended_sop": parsed.get("recommended_sop", ""),
        "reasoning": parsed.get("reasoning", ""),
    }

    print(f"  根因: {diagnosis['root_cause']}")
    print(f"  置信度: {diagnosis['confidence']:.2f}")
    print(f"  推荐 SOP: {diagnosis['recommended_sop']}")

    return {
        "diagnosis": diagnosis,
        "trace": [f"[Diagnosis] {diagnosis['root_cause']} (置信度 {diagnosis['confidence']:.2f})"],
    }
