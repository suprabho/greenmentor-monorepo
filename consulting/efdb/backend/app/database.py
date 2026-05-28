from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData
from app.config import settings

# All EFDB tables live in the `efdb` Postgres schema (we share a Supabase
# project with other apps that own the `public` schema). Setting `schema` on
# the shared MetaData makes every model that inherits Base land in `efdb`
# automatically — no need to touch each model file.
class Base(DeclarativeBase):
    metadata = MetaData(schema="efdb")


# `search_path` keeps unqualified references reachable from queries running
# against the `efdb` schema — specifically the `vector` type and the
# `gin_trgm_ops` operator class, both of which live in `public`.
engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"server_settings": {"search_path": "efdb,public"}},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
