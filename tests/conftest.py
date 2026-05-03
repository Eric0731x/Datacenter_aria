"""pytest 全局配置。

自定义 mark：
  @pytest.mark.integration  需要真实 API + 网络，使用 -m integration 显式开启
"""
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: 需要真实 LLM API 和网络访问，默认跳过（-m integration 显式运行）",
    )
