from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analyze import router as analyze_router
from app.routers.admin import router as admin_router
from app.routers.copilot import router as copilot_router


app = FastAPI(
    title="AYÇA Insight API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ayca-panel.vercel.app",
    ],
    allow_origin_regex=r"https://.*-3000\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "AYÇA Insight API çalışıyor.",
    }


@app.get("/health")
def health_check():
    return {
        "success": True,
        "status": "healthy",
    }


app.include_router(analyze_router)
app.include_router(admin_router)
app.include_router(copilot_router)