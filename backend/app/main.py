from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analyze


app = FastAPI(
    title="AYÇA Insight API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://congenial-trout-g7965j94493jwg-3000.app.github.dev",
    ],
    allow_origin_regex=r"https://.*-3000\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)


@app.get("/")
def root():
    return {
        "message": "AYÇA Insight API",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }