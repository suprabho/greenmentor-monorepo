import logging
from contextlib import asynccontextmanager
import anthropic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.routers import auth, emission_factors, ingestion, chat
from app.database import engine, Base
from app.config import settings
from app.models import *  # noqa: ensure all models are registered

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("efdb")


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
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(anthropic.APIStatusError)
async def anthropic_error_handler(request: Request, exc: anthropic.APIStatusError):
    """Surface AI provider failures (billing, rate limits, overload) as a 502
    with the provider's message, instead of an opaque 500."""
    body = getattr(exc, "body", None)
    msg = (body.get("error", {}).get("message") if isinstance(body, dict) else None) or str(exc)
    logger.error("Anthropic API error (%s) on %s %s: %s",
                 exc.status_code, request.method, request.url.path, msg)
    return JSONResponse(status_code=502, content={"detail": f"AI provider error: {msg}"})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    # One-line context; uvicorn logs the full traceback when this re-raises.
    logger.error("Unhandled error on %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(emission_factors.router)
app.include_router(ingestion.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "EFDB API"}
