"""Kimi K2.6 客户端封装。

Kimi K2.6 完全兼容 OpenAI API，所以直接用 langchain-openai 的 ChatOpenAI。
唯一要注意：thinking 模式通过 extra_body 传递，不是顶层参数。

两种模式的选择原则：
- instant: 分诊、简单分类、规则判定（低延迟，省成本）
- thinking: 根因诊断、SOP 生成、复盘（需要深度推理）
"""
import os
from typing import Literal
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()


def get_kimi_llm(
    mode: Literal["instant", "thinking"] = "instant",
    temperature: float | None = None,
) -> ChatOpenAI:
    """获取 Kimi K2.6 客户端。

    Args:
        mode: instant 走快速回答，thinking 走深度推理（CoT）
        temperature: 不传则按官方推荐值（thinking=1.0, instant=0.6）

    Returns:
        配置好的 ChatOpenAI 实例
    """
    api_key = os.getenv("MOONSHOT_API_KEY")
    base_url = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1")

    if not api_key:
        raise RuntimeError(
            "未设置 MOONSHOT_API_KEY。请复制 .env.example 为 .env 并填入 API Key。"
        )

    # 官方推荐温度
    if temperature is None:
        temperature = 1.0 if mode == "thinking" else 0.6

    # thinking 模式通过 extra_body 控制（K2.6 的设计）
    extra_body = {}
    if mode == "instant":
        extra_body["thinking"] = {"type": "disabled"}

    return ChatOpenAI(
        model="kimi-k2.6",
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        max_tokens=4096,
        extra_body=extra_body if extra_body else None,
    )
