from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.routers import auth, emission_factors, ingestion, chat
from app.database import engine, Base
from app.models import *  # noqa: ensure all models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enable required PostgreSQL extensions and create all tables
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="EFDB — Emission Factor Database",
    version="1.0.0",
    description="Internal GHG emission factor database with AI-powered ingestion and retrieval.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(emission_factors.router)
app.include_router(ingestion.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "EFDB API"}
