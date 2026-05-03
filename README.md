# Datacenter_aria
Datacenter Aria 是数据中心硬件故障自动诊断与自愈系统。 三个 Agent 串联：Triage（告警分诊，instant 快速）→ Diagnosis（根因诊断，thinking 深度推理调工具）→ Action（执行+工单派发）。 用 LangGraph 编排，Kimi K2.6 推理，shared state 全透明。低风险自动执行，高风险创建工单待审批。Mock 工具便于本地跑通，后续直接替换 MCP server。
