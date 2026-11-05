"""应用配置。"""


class Settings:
    """应用配置项。"""

    # 应用信息
    app_name: str = "力学分析软件"
    app_version: str = "0.1.0"

    # CORS 配置
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # 求解器参数
    max_nodes: int = 10000
    max_elements: int = 20000


settings = Settings()
