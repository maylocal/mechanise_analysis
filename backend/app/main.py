"""FastAPI 应用入口。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import analysis, data


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用实例。"""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="结构静力学有限元分析服务",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(analysis.router, prefix="/api/analysis", tags=["分析"])
    app.include_router(data.router, prefix="/api/data", tags=["数据"])

    @app.get("/", tags=["健康检查"])
    def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
        }

    @app.get("/health", tags=["健康检查"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
