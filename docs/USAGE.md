# Datacenter Aria 使用说明

多智能体服务器维护原型，将 **Triage → Diagnosis → Action** 三个 Agent 用 LangGraph 串起来，实现告警的自动分诊、根因诊断和处置执行。

## 技术栈

| 组件 | 技术 |
|------|------|
| 模型 | Kimi K2.6（OpenAI 兼容 API） |
| 编排 | LangGraph 0.2+ |
| IPMI | python-ipmi + 系统 ipmitool |
| 开发 | Claude Code |

## 目录结构

```
datacenter-aria/
├── orchestrator/          # 核心编排
│   ├── state.py           # 共享状态 schema
│   ├── graph.py           # LangGraph 主图
│   └── llm.py             # Kimi K2.6 客户端
├── agents/                # 三个 Agent
│   ├── triage.py          # 告警分诊（instant 模式，低延迟）
│   ├── diagnosis.py       # 根因诊断（thinking 模式，深度推理）
│   └── action.py          # 动作执行（带人工审批门）
├── tools/
│   └── mock_tools.py      # 工具实现（IPMI 真实调用，其余 mock）
├── fixtures/
│   └── sample_alerts.json # 测试告警样本
├── tests/
│   └── test_graph.py      # 端到端测试
├── main.py                # 入口
└── requirements.txt
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

```bash
cp .env.example .env
```

编辑 `.env`，填入以下变量：

```env
# Kimi K2.6 API（必填）
MOONSHOT_API_KEY=your_api_key_here
MOONSHOT_BASE_URL=https://api.moonshot.ai/v1

# IPMI 带外管理（可选，有真实环境时填入）
IPMI_USER=admin
IPMI_PASSWORD=admin
```

### 3. 安装 ipmitool（Linux）

```bash
# Debian/Ubuntu
sudo apt install ipmitool

# RHEL/CentOS
sudo yum install ipmitool
```

> **注意**：python-ipmi 底层通过调用系统 `ipmitool` 命令与 BMC 通信，Windows 环境需要配合 OEM 的 IPMI 软件使用。

### 4. 跑 Demo

```bash
# 使用默认告警样本
python main.py

# 使用自定义告警文件
python main.py path/to/your_alerts.json
```

正常输出：

```
加载告警: fixtures\sample_alerts.json
共 3 条

========== [TRIAGE] 开始分诊 ==========
  聚合为 1 个事件，优先级 P1
  判定为非噪声

========== [DIAGNOSIS] 开始诊断 ==========
  Loop 1: 模型请求 3 次工具调用
  [TOOL] ipmi_get_sensor(host=node-001, sensor_type=all)
  [TOOL] ipmi_get_sel(host=node-001, limit=20)
  [TOOL] search_similar_incidents(query='...')
  根因: 风扇 FAN1 故障导致 CPU 过热
  置信度: 0.85
  推荐 SOP: fan_failure

========== [ACTION] 开始执行 ==========
  执行了 3 个动作
  工单 ID: OPS-3A7F2C
  状态: pending_approval
  需人工审批: True

============================================================
最终结果
状态: pending
```

## 工具说明

### IPMI 工具（已替换为真实调用）

| 工具 | 说明 | 依赖 |
|------|------|------|
| `ipmi_get_sensor` | 读取主机传感器（温度/风扇/电压/电源） | ipmitool + BMC 网络可达 |
| `ipmi_get_sel` | 读取系统事件日志（SEL） | 同上 |

**环境变量配置**：

```env
IPMI_USER=admin          # 默认 admin
IPMI_PASSWORD=admin       # 默认 admin
```

**连接测试**（在服务器上）：

```bash
# 验证 BMC 网络可达
ping bmc-hostname-or-ip

# 验证 ipmitool 可用
ipmitool -I lan -H bmc-hostname-or-ip -U admin -P admin sensor list
```

### 其他工具（mock 实现）

| 工具 | 说明 | 后续替换 |
|------|------|---------|
| `smart_query` | 硬盘 SMART 健康查询 | 接入真实存储监控 |
| `ansible_run_playbook` | 执行 Ansible playbook | Ansible MCP Server |
| `jira_create_ticket` | 创建运维工单 | Jira MCP Server |
| `search_similar_incidents` | 检索历史相似案例 | 向量数据库 |
| `search_sop` | 检索标准操作手册 | 知识库 |

## Agent 工作流程

```
    START
      │
      ▼
   [Triage]          instant 模式，低延迟
      │
      ▼
   <should_skip?>
   ├─ True  → END (打 skipped 标签，噪声告警)
   └─ False ↓
   [Diagnosis]       thinking 模式，深度推理
      │              调用 IPMI/SMART/SEL 工具
      ▼
   [Action]          执行 SOP 或创建工单
      │
      ▼
    END
```

**Triage**：判定告警是否为噪声，聚合相关告警，输出优先级（P0-P3）

**Diagnosis**：调用 IPMI 工具收集证据，结合历史案例给出根因和置信度

**Action**：根据 SOP 执行处置动作，高风险动作挂起等待人工审批

## 测试

```bash
pytest tests/

# 只跑集成测试（需要真实 API Key）
pytest tests/ -v

# 跳过需要 API Key 的测试
pytest tests/ -v --ignore-glob='*test_graph.py'
```

## 扩展指南

### 接入真实 Jira

修改 `tools/mock_tools.py` 中的 `jira_create_ticket`，接入 [Jira MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/jira) 或直接调用 Jira REST API。

### 接入真实 Ansible

将 `ansible_run_playbook` 替换为 [Ansible MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/ansible)，实现真正的自动化执行。

### 接入 LangSmith 可观测性

```python
from langsmith import traceable

@traceable
def diagnosis_node(state):
    ...
```

### 添加新的工具

1. 在 `tools/mock_tools.py` 中用 `@tool` 装饰器定义函数
2. 导入并加入对应 Agent 的工具列表（`DIAGNOSIS_TOOLS` / `ACTION_TOOLS`）
3. 函数签名和返回类型（字符串）保持不变，确保向后兼容

## 故障排查

**python-ipmi 未安装**
```
{"error": "python-ipmi not installed"}
```
解决：`pip install python-ipmi>=0.5.0`

**IPMI 连接失败**
```
{"error": "IpmiConnectionError: Unable to open session"
```
检查：网络可达、BMC 用户名密码正确、`ipmitool` 命令可用

**Kimi API Key 无效**
```
RuntimeError: 未设置 MOONSHOT_API_KEY
```
解决：在 `.env` 中正确设置 `MOONSHOT_API_KEY`

**SEL 条目解析为空**
SEL 记录格式因厂商而异，`_format_sel_entry` 会 fallback 到原始字符串，不会中断执行。