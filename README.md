# Datacenter Aria - 多智能体服务器维护原型

最小可运行原型，把 **Triage → Diagnosis → Action** 三个 Agent 用 LangGraph 串起来。

## 技术栈

- **模型**：Kimi K2.6（OpenAI 兼容 API）
- **编排**：LangGraph 0.2+
- **开发**：Claude Code
- **工具调用**：mock 实现（便于本地跑通；后续替换为真实 IPMI/Ansible/Jira MCP）

## 目录结构

```
datacenter-aria/
├── orchestrator/
│   ├── state.py          # 共享状态 schema
│   ├── graph.py          # LangGraph 主图
│   └── llm.py            # Kimi K2.6 客户端封装
├── agents/
│   ├── triage.py         # 告警分诊
│   ├── diagnosis.py      # 根因诊断
│   └── action.py         # 动作执行
├── tools/
│   └── mock_tools.py     # IPMI/Ansible/Jira mock
├── fixtures/
│   └── sample_alerts.json # 测试用告警样本
├── tests/
│   └── test_graph.py     # 端到端测试
├── main.py               # 入口
├── requirements.txt
└── .env.example
```

## 快速开始

```bash
# 1. 装依赖
pip install -r requirements.txt

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 MOONSHOT_API_KEY

# 3. 跑 demo
python main.py

# 4. 跑测试
pytest tests/
```

## 设计要点

1. **状态机驱动**：所有 Agent 共享一个 `MaintenanceState`，便于追溯每一步推理
2. **Triage 用 instant 模式**：低延迟、低成本（Kimi K2.6 的 instant 模式）
3. **Diagnosis 用 thinking 模式**：复杂推理，开启思考模式
4. **Action 带人在回路**：高风险动作必须 `requires_approval=True`，低风险自动执行
5. **可观测性**：每个节点的输入输出全量打印，便于 Claude Code 调试

## 后续扩展点

- [ ] 把 mock_tools 替换为真实 MCP server
- [ ] 加 Knowledge Agent，事件闭环后写入向量库
- [ ] 接入 LangSmith 做 trace
- [ ] 加 retry/fallback 节点
