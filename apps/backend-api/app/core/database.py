"""
Async SQLAlchemy engine, session factory, and declarative Base.
Uses asyncpg as the PostgreSQL driver.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# ── Engine ──
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.is_development,
    pool_size=5,
    max_overflow=10,
)

# ── Session factory ──
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative Base ──
class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ── Dependency ──
async def get_db():
    """FastAPI dependency that yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Startup helper ──
async def init_db():
    """Create all tables. Called once during app startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose the engine connection pool. Called during app shutdown."""
    await engine.dispose()
