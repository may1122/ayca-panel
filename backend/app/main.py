from fastapi import FastAPI
from app.routers import analyze

app = FastAPI(
    title="AYÇA Insight API",
    version="1.0.0"
)

app.include_router(analyze.router)


@app.get("/")
def root():
    return {
        "message": "AYÇA Insight API"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }