import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with env var.
# Note: Alembic stores this through ConfigParser, which treats `%` as
# interpolation syntax (`%(name)s`). URL-encoded passwords contain `%XX`
# escapes (e.g. `%21` for `!`), so we double the `%` to keep them literal.
# SQLAlchemy itself receives the original string from configparser.get().
database_url_sync = os.environ.get("DATABASE_URL_SYNC")
if database_url_sync:
    config.set_main_option("sqlalchemy.url", database_url_sync.replace("%", "%%"))

# Import all models so Alembic can detect them
from app.database import Base
import app.models  # noqa: F401

target_metadata = Base.metadata


# We share a Supabase Postgres instance with other apps that own `public` and
# `auth`. Restrict Alembic's autogenerate diff to the `efdb` schema so it never
# proposes to drop / rename objects belonging to vismay or Supabase Auth.
def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == "efdb"
    return True


# Common kwargs for both offline and online modes:
#   include_schemas=True       — make Alembic schema-aware so it actually looks
#                                at the `efdb` namespace instead of just `public`.
#   include_name=include_name  — but only diff the `efdb` schema (see above).
#   version_table_schema="efdb"— keep Alembic's own `alembic_version` table out
#                                of `public`; co-locate it with EFDB tables.
_alembic_kwargs = dict(
    target_metadata=target_metadata,
    include_schemas=True,
    include_name=include_name,
    version_table_schema="efdb",
)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, literal_binds=True, **_alembic_kwargs)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, **_alembic_kwargs)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
