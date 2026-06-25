import asyncio
import os
import sys
from logging.config import fileConfig
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ---- add src to path ----
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PATH = os.path.join(PROJECT_ROOT, "src")
sys.path.insert(0, SRC_PATH)

# ---- project imports ----
import novax_price_alert.db.models  # noqa: E402,F401
from novax_price_alert.core.settings import settings  # noqa: E402
from novax_price_alert.db.base import Base  # noqa: E402

# ---- alembic config ----
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = settings.database_url
connect_args: dict[str, str] = {}
if database_url.startswith("postgresql") and ("ssl=" in database_url or "sslmode=" in database_url):
    parsed = urlparse(database_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    ssl_mode = query.pop("ssl", query.pop("sslmode", [None]))[0]
    if ssl_mode:
        connect_args["ssl"] = ssl_mode
    database_url = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
