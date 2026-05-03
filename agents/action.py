"""Action Agent：动作执行。

职责：
1. 根据 Diagnosis 输出的 SOP，决定具体动作
2. 低风险动作直接执行（dry_run 验证 → 真实执行）
3. 高风险动作只创建工单，等人审批
4. 始终创建工单留档（即使是自动处理）

风险等级判定：
- low: 可自动执行（清日志、查状态、kill 进程）
- medium: 自动执行 dry_run，真实执行需通知值班
- high: 仅创建工单，不自动执行（重启物理机、换硬件、迁业务）
"""
import json
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from orchestrator.llm import get_kimi_llm
from orchestrator.state import MaintenanceState, ActionResult
from tools.mock_tools import ACTION_TOOLS


SYSTEM_PROMPT = """你是数据中心运维执行助手。你需要根据诊断结论和推荐的 SOP，决定具体的处置动作。

执行原则：
1. 先调用 search_sop 获取标准操作步骤
2. 评估 SOP 的 risk_level：
   - low：可以自动执行 ansible（先 dry_run，再实际执行）
   - high：仅创建 Jira 工单，绝对不要自动执行任何 ansible
3. 无论是否自动执行，都必须创建 Jira 工单留档
4. 工单优先级与 incident 优先级保持一致
5. 工单描述必须包含：根因、置信度、已执行的动作、待人工确认的事项

完成后输出严格 JSON：
{
  "actions_taken": [{"tool": "...", "args": {...}, "result": "..."}],
  "requires_approval": true | false,
  "ticket_id": "OPS-XXXXXX" 或 null,
  "status": "completed" | "pending_approval" | "failed"
}"""

MAX_TOOL_LOOPS = 6


def action_node(state: MaintenanceState) -> dict:
    """Action 节点。"""
    print("\n========== [ACTION] 开始执行 ==========")

    triage = state["triage"]
    diagnosis = state["diagnosis"]

    user_msg = f"""请根据以下诊断结论决定处置动作：

事件 ID: {triage['incident_id']}
优先级: {triage['priority']}
根因: {diagnosis['root_cause']}
置信度: {diagnosis['confidence']:.2f}
受影响组件: {diagnosis['affected_components']}
推荐 SOP: {diagnosis['recommended_sop']}

请按 SOP 执行，并创建工单。低置信度（<0.7）时倾向于不自动执行。"""

    llm = get_kimi_llm(mode="thinking", temperature=0.3)
    llm_with_tools = llm.bind_tools(ACTION_TOOLS)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ]

    tool_map = {t.name: t for t in ACTION_TOOLS}
    actions_log = []  # 记录所有工具调用
    final_content = None

    for loop in range(MAX_TOOL_LOOPS):
        response = llm_with_tools.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            final_content = response.content
            break

        print(f"  Loop {loop+1}: 执行 {len(response.tool_calls)} 个动作")

        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]

            if tool_name not in tool_map:
                tool_result = f"ERROR: 未知工具 {tool_name}"
            else:
                tool_result = tool_map[tool_name].invoke(tool_args)

            actions_log.append({
                "tool": tool_name,
                "args": tool_args,
                "result": str(tool_result)[:500],  # 截断防止过长
            })

            messages.append(ToolMessage(
                content=str(tool_result),
                tool_call_id=tc["id"],
            ))
    else:
        print(f"  [WARN] 达到工具调用上限")
        messages.append(HumanMessage(content="请直接输出 JSON 总结。"))
        final_content = llm.invoke(messages).content

    # 解析最终 JSON
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
        parsed = {
            "actions_taken": actions_log,
            "requires_approval": True,
            "ticket_id": None,
            "status": "failed",
        }

    # 强制用我们记录的真实动作日志（防止 LLM 幻觉）
    parsed["actions_taken"] = actions_log

    # 从动作日志里抽 ticket_id
    if not parsed.get("ticket_id"):
        for a in actions_log:
            if a["tool"] == "jira_create_ticket":
                try:
                    ticket_data = json.loads(a["result"])
                    parsed["ticket_id"] = ticket_data.get("ticket_id")
                except (json.JSONDecodeError, KeyError):
                    pass

    action_result: ActionResult = {
        "actions_taken": parsed["actions_taken"],
        "requires_approval": parsed.get("requires_approval", True),
        "ticket_id": parsed.get("ticket_id"),
        "status": parsed.get("status", "pending_approval"),
    }

    print(f"  执行了 {len(action_result['actions_taken'])} 个动作")
    print(f"  工单 ID: {action_result['ticket_id']}")
    print(f"  状态: {action_result['status']}")
    print(f"  需人工审批: {action_result['requires_approval']}")

    return {
        "action": action_result,
        "trace": [f"[Action] {action_result['status']}, 工单 {action_result['ticket_id']}"],
        "final_status": "pending" if action_result["requires_approval"] else "success",
    }
