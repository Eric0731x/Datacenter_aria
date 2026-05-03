"""工具实现。

IPMI 工具使用 python-ipmi 库（底层调用系统 ipmitool）执行真实的带外管理。
其他工具（Ansible/Jira）保持 mock，后续替换为对应 MCP server。

每个工具都打印调用日志，方便看清楚 Agent 调了什么。
"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional
from langchain_core.tools import tool

try:
    import python_ipmi
    from python_ipmi.interfaces.ipmitool import Ipmitool
    _HAS_PYIPMI = True
except ImportError:
    _HAS_PYIPMI = False


def _build_connection(host: str, username: str = "admin", password: str = "admin") -> "python_ipmi.Ipmi":
    """建立 IPMI 连接并返回 Ipmi 实例（上下文管理器）。"""
    interface = Ipmitool(interface_type='lan')
    interface._session = python_ipmi.Session()
    interface._session.rmcp_host = host
    interface._session.rmcp_port = 623
    interface._session.username = username
    interface._session.password = password
    interface._session.auth_type = python_ipmi.Session.AUTH_TYPE_DEFAULT
    connection = python_ipmi.create_connection(interface)
    connection.open()
    connection.session.establish()
    return connection


def _resolve_sensor_number(connection: "python_ipmi.Ipmi", sensor_name: str) -> Optional[int]:
    """根据传感器名称查找 sensor number，找不到返回 None。"""
    try:
        for record in connection.device_sdr_entries():
            if hasattr(record, 'name') and record.name == sensor_name:
                return record.sensor_number
    except Exception:
        pass
    return None


# ====================== IPMI / 带外管理 ======================

@tool
def ipmi_get_sensor(host: str, sensor_type: str = "all") -> str:
    """获取指定主机的 IPMI 传感器读数（温度、风扇、电压、电源）。

    Args:
        host: 主机名或 IP
        sensor_type: temperature / fan / voltage / power / all

    Returns:
        JSON 字符串，包含各类型传感器的当前读数。
    """
    print(f"  [TOOL] ipmi_get_sensor(host={host}, sensor_type={sensor_type})")

    if not _HAS_PYIPMI:
        return json.dumps({"error": "python-ipmi not installed"}, indent=2)

    try:
        username = os.environ.get("IPMI_USER", "admin")
        password = os.environ.get("IPMI_PASSWORD", "admin")
        with _build_connection(host, username, password) as conn:
            sensor_data: dict = {}
            sensor_map = {
                "temperature": ["CPU0 Temp", "CPU1 Temp", "Inlet Temp", "Exhaust Temp"],
                "fan":         ["FAN 1", "FAN 2", "FAN 3", "FAN 4"],
                "voltage":     ["3.3V", "5V", "12V"],
                "power":       ["PSU 1 Status", "PSU 2 Status"],
            }

            for stype, names in sensor_map.items():
                if sensor_type != "all" and stype != sensor_type:
                    continue
                sensor_data[stype] = {}
                for name in names:
                    num = _resolve_sensor_number(conn, name)
                    if num is None:
                        sensor_data[stype][name] = None
                        continue
                    try:
                        reading = conn.get_sensor_reading(num)
                        sensor_data[stype][name] = reading
                    except Exception:
                        sensor_data[stype][name] = None

            return json.dumps(sensor_data, indent=2, default=str)

    except Exception as e:
        print(f"  [TOOL] ipmi_get_sensor error: {e}")
        return json.dumps({"error": str(e)}, indent=2)


@tool
def ipmi_get_sel(host: str, limit: int = 20) -> str:
    """获取 IPMI 系统事件日志（SEL）。

    Args:
        host: 主机名或 IP
        limit: 返回最近 N 条

    Returns:
        JSON 数组，每条记录包含 time 和 event 字段。
    """
    print(f"  [TOOL] ipmi_get_sel(host={host}, limit={limit})")

    if not _HAS_PYIPMI:
        return json.dumps([{"error": "python-ipmi not installed"}], indent=2)

    try:
        username = os.environ.get("IPMI_USER", "admin")
        password = os.environ.get("IPMI_PASSWORD", "admin")
        with _build_connection(host, username, password) as conn:
            reservation = conn.get_sel_reservation_id()
            total = conn.get_sel_entries_count()
            sel_events: list = []
            # SEL record IDs 从 1 开始递增
            for record_id in range(1, min(total + 1, limit + 1)):
                try:
                    entry = conn.get_sel_entry(record_id, reservation)
                    # entry 是原始 bytes，不同厂商格式不同，尝试解析为可读字符串
                    event_str = _format_sel_entry(entry)
                    if event_str:
                        sel_events.append(event_str)
                except Exception:
                    break  # 无更多记录

            return json.dumps(sel_events, indent=2, ensure_ascii=False)

    except Exception as e:
        print(f"  [TOOL] ipmi_get_sel error: {e}")
        return json.dumps([{"error": str(e)}], indent=2)


def _format_sel_entry(entry) -> dict:
    """将 SEL 条目解析为 dict，返回 {'time': ..., 'event': ...}。"""
    try:
        # python-ipmi sel 条目为 bytes，格式：2字节record_id + 14字节data + …
        data = getattr(entry, 'event_data', None) or getattr(entry, 'data', b'')
        event_str = " ".join(f"{b:02x}" for b in data[:13]) if data else ""
        # 取时间戳字段（如果有）
        timestamp = getattr(entry, 'timestamp', 0) or 0
        if timestamp:
            import struct
            ts = struct.unpack_from("<I", bytes(timestamp))[0] if not isinstance(timestamp, int) else timestamp
            time_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
        else:
            time_str = "unknown"
        return {"time": time_str, "event": event_str or str(entry)}
    except Exception:
        return {"time": "unknown", "event": str(entry)}


# ====================== SMART / 硬盘健康 ======================

@tool
def smart_query(host: str, device: str = "/dev/sda") -> str:
    """查询硬盘 SMART 健康状态。

    Args:
        host: 主机名
        device: 设备路径，默认 /dev/sda
    """
    print(f"  [TOOL] smart_query(host={host}, device={device})")
    return json.dumps({
        "device": device,
        "model": "SAMSUNG MZ7LH960HAJR-00005",
        "health": "PASSED",
        "reallocated_sectors": 0,
        "current_pending_sectors": 0,
        "temperature": 38,
        "power_on_hours": 18234,
    }, indent=2)


# ====================== Ansible / 自动化执行 ======================

@tool
def ansible_run_playbook(host: str, playbook: str, dry_run: bool = True) -> str:
    """在指定主机执行 Ansible playbook。

    Args:
        host: 目标主机
        playbook: playbook 文件名（如 restart_service.yml）
        dry_run: True 表示只检查不执行（强烈建议先 dry_run）
    """
    print(f"  [TOOL] ansible_run_playbook(host={host}, playbook={playbook}, dry_run={dry_run})")
    if dry_run:
        return f"DRY RUN OK: {playbook} 在 {host} 上检查通过，预计影响 1 个服务"
    return f"EXECUTED: {playbook} 在 {host} 完成，耗时 12s"


# ====================== Jira / 工单 ======================

@tool
def jira_create_ticket(
    title: str,
    description: str,
    priority: str = "P2",
    assignee: str = "ops-team",
) -> str:
    """创建运维工单。

    Args:
        title: 工单标题
        description: 详细描述（应包含告警、诊断结论、建议动作）
        priority: P0/P1/P2/P3
        assignee: 默认派给 ops-team
    """
    print(f"  [TOOL] jira_create_ticket(title={title!r}, priority={priority})")
    ticket_id = f"OPS-{uuid.uuid4().hex[:6].upper()}"
    return json.dumps({
        "ticket_id": ticket_id,
        "url": f"https://jira.example.com/browse/{ticket_id}",
        "status": "Open",
        "created_at": datetime.now().isoformat(),
    }, indent=2)


# ====================== 知识检索（Diagnosis 用）======================

@tool
def search_similar_incidents(query: str, top_k: int = 3) -> str:
    """在历史工单库中检索相似案例。

    Args:
        query: 故障描述查询
        top_k: 返回前 N 个最相似案例
    """
    print(f"  [TOOL] search_similar_incidents(query={query!r})")
    # mock：模拟向量库返回的相似案例
    fake_cases = [
        {
            "case_id": "INC-2025-1142",
            "summary": "Dell R750 风扇 FAN1 故障导致 CPU 过热降频",
            "resolution": "更换故障风扇模块，重启 BMC 清告警",
            "similarity": 0.92,
        },
        {
            "case_id": "INC-2025-0876",
            "summary": "机柜 A12 多台机器 CPU 温度异常，定位为冷通道封闭失效",
            "resolution": "检查机柜冷热通道密封，调整空调风量",
            "similarity": 0.78,
        },
        {
            "case_id": "INC-2024-3301",
            "summary": "PSU 单电源失效未告警，引发风扇全速保护",
            "resolution": "更换 PSU2，启用双路监控",
            "similarity": 0.65,
        },
    ]
    return json.dumps(fake_cases[:top_k], indent=2, ensure_ascii=False)


@tool
def search_sop(keyword: str) -> str:
    """检索标准操作手册（SOP）。

    Args:
        keyword: 故障类型关键词，如 "fan_failure"、"cpu_overheat"
    """
    print(f"  [TOOL] search_sop(keyword={keyword!r})")
    sops = {
        "fan_failure": {
            "sop_id": "SOP-HW-001",
            "title": "服务器风扇故障处理标准流程",
            "steps": [
                "1. 通过 IPMI 确认是哪个风扇位故障（FAN ID）",
                "2. 检查同机型是否有备件库存",
                "3. 派发硬件更换工单到机房运维",
                "4. 更换前先迁移业务（如承载核心业务）",
                "5. 热插拔更换风扇模块",
                "6. 通过 ipmitool sel clear 清除告警",
                "7. 验证 24h 无温度异常",
            ],
            "risk_level": "low",
        },
        "cpu_overheat": {
            "sop_id": "SOP-HW-005",
            "title": "CPU 过热应急处理",
            "steps": [
                "1. 立即降低 CPU 频率（节流）",
                "2. 检查风扇、散热器、机柜进风温度",
                "3. 业务迁移评估",
                "4. 必要时下电检修",
            ],
            "risk_level": "high",
        },
    }
    return json.dumps(sops.get(keyword, {"error": f"未找到 SOP: {keyword}"}), ensure_ascii=False, indent=2)


# 工具集合，按 Agent 分组
TRIAGE_TOOLS: list = []  # Triage 不调工具，纯文本推理
DIAGNOSIS_TOOLS = [ipmi_get_sensor, ipmi_get_sel, smart_query, search_similar_incidents]
ACTION_TOOLS = [search_sop, ansible_run_playbook, jira_create_ticket]
