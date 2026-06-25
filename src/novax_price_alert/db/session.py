from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from novax_price_alert.core.settings import settings
from novax_price_alert.db import models  # noqa: F401

_db_url = settings.database_url

_connect_args = {}
if _db_url.startswith("postgresql") and ("ssl=" in _db_url or "sslmode=" in _db_url):
    parsed = urlparse(_db_url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = qs.pop("ssl", qs.pop("sslmode", [None]))[0]
    if sslmode:
        _connect_args["ssl"] = sslmode
    new_qs = urlencode(qs, doseq=True)
    _db_url = urlunparse(parsed._replace(query=new_qs))

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    connect_args=_connect_args,
    pool_pre_ping=True,
)

# Create a configured "SessionLocal" factory.
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Keep objects from being expired after commit
)


# Dependency to get a database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides a database session to the API endpoints.
    Ensures the session is closed after use.
    """
    async with AsyncSessionLocal() as session:
        yield session
