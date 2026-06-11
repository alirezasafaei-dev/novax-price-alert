from collections.abc import AsyncGenerator
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from novax_price_alert.core.settings import settings
from novax_price_alert.db import models  # noqa: F401

# Project root for SQLite fallback
BASE_DIR = Path(__file__).resolve().parents[3]
SQLITE_DB_PATH = BASE_DIR / "novax_price_alert.db"

_db_url = settings.database_url

# Strip sslmode from URL for asyncpg compatibility
_connect_args = {}
if "sslmode=" in _db_url:
    parsed = urlparse(_db_url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = qs.pop("sslmode", [None])[0]
    if sslmode:
        _connect_args["ssl"] = sslmode == "require"
    new_qs = urlencode(qs, doseq=True)
    _db_url = urlunparse(parsed._replace(query=new_qs))

# Determine if we should use SQLite fallback
# Use SQLite if:
# 1. The URL is already SQLite
# 2. The URL is PostgreSQL but we can't connect (quick check)
_use_sqlite = False
if _db_url.startswith("sqlite"):
    _use_sqlite = True
else:
    # Quick TCP check — 2 second timeout
    import socket
    parsed = urlparse(_db_url)
    host = parsed.hostname
    port = parsed.port or 5432
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        if result != 0:
            _use_sqlite = True
    except Exception:
        _use_sqlite = True

    # Even if TCP works, asyncpg might fail (SSL, auth, etc.)
    # Do a quick SQLAlchemy connection test with short timeout
    if not _use_sqlite:
        import asyncio

        async def _test_conn() -> bool:
            test_engine = create_async_engine(
                _db_url,
                connect_args=_connect_args,
                pool_timeout=3,
            )
            try:
                async with test_engine.begin() as conn:
                    await conn.execute(text("SELECT 1"))
                return True
            except Exception:
                return False
            finally:
                await test_engine.dispose()

        try:
            loop = asyncio.new_event_loop()
            connected = loop.run_until_complete(
                asyncio.wait_for(_test_conn(), timeout=5)
            )
            loop.close()
            if not connected:
                _use_sqlite = True
        except Exception:
            _use_sqlite = True

if _use_sqlite:
    _db_url = f"sqlite+aiosqlite:///{SQLITE_DB_PATH}"

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    connect_args=_connect_args if not _use_sqlite else {},
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
