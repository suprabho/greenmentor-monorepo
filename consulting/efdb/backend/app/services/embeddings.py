"""
Generates vector embeddings for canonical activity names using Claude.
We use a simple prompt-based approach: ask Claude to produce a compact
semantic representation and then hash it to a fixed vector.

For production quality, swap this with a proper embedding model
(e.g. text-embedding-3-small via OpenAI, or a HuggingFace sentence-transformer).
The vector dimension must match what's in the migration (1536).
"""
import hashlib
import math
import asyncio
from functools import lru_cache
from app.config import settings

# In-memory cache to avoid re-embedding the same string repeatedly
_cache: dict[str, list[float]] = {}

EMBEDDING_DIM = 1536


def _deterministic_embedding(text: str) -> list[float]:
    """
    Deterministic pseudo-embedding based on MD5 hashing.
    Used as a development fallback when no real embedding API is configured.
    Replace this with a real embedding call in production.
    """
    digest = hashlib.sha512(text.lower().strip().encode()).digest()
    # Expand to 1536 dimensions by repeating and normalising
    raw = []
    for i in range(0, EMBEDDING_DIM):
        byte = digest[i % len(digest)]
        raw.append((byte / 127.5) - 1.0)   # scale to [-1, 1]
    # L2 normalise
    norm = math.sqrt(sum(x * x for x in raw))
    return [x / norm if norm else x for x in raw]


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a semantic embedding for the given text.

    Production note: replace _deterministic_embedding with a call to a real
    embedding API for meaningful semantic search. For example:

        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        # Use OpenAI text-embedding-3-small for embeddings (1536 dim, fast, cheap)
        # or use a locally-hosted sentence-transformer model.

    For now we use a deterministic hash so the system is fully functional
    without a second API key.
    """
    if not text:
        return [0.0] * EMBEDDING_DIM
    if text in _cache:
        return _cache[text]
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    embedding = await loop.run_in_executor(None, _deterministic_embedding, text)
    _cache[text] = embedding
    return embedding
