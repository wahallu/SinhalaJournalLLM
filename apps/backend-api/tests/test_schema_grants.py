"""
Every table created by raw SQL must be granted to service_role.

schema.sql already explains why: tables created by raw SQL do not inherit
the privileges Supabase attaches to tables made through its UI, so without
an explicit grant every service-role read fails with "permission denied" —
which reaches the client as a 500.

This is not something the suite can catch by exercising the code. The test
fake has no permissions model, so a missing grant passes every functional
test and fails only against a real database. Reading the SQL is the only
way to catch it before deploy, which is what this does.

Found two real ones when it was written: `plans` (500 on the catalog) and
`suggestion_events` (research events silently dropped, because
record_events never raises).
"""

import pathlib
import re

import pytest

SQL_ROOT = pathlib.Path(__file__).resolve().parent.parent

CREATE_TABLE = re.compile(r"create table if not exists\s+(?:public\.)?(\w+)", re.I)
# Covers both spellings already in the repo: "grant all on table public.x"
# and "grant all privileges on public.x".
GRANT_SERVICE_ROLE = re.compile(
    r"grant\s+[\w\s,]+?\s+on\s+(?:table\s+)?(?:public\.)?(\w+)\s+to\s+service_role", re.I
)


def _sql_files() -> list[pathlib.Path]:
    return [SQL_ROOT / "schema.sql"] + sorted((SQL_ROOT / "migrations").glob("*.sql"))


def _scan() -> tuple[dict[str, str], set[str]]:
    created: dict[str, str] = {}
    granted: set[str] = set()
    for path in _sql_files():
        sql = path.read_text()
        for match in CREATE_TABLE.finditer(sql):
            created.setdefault(match.group(1), path.name)
        for match in GRANT_SERVICE_ROLE.finditer(sql):
            granted.add(match.group(1))
    return created, granted


def test_sql_files_are_discovered():
    """Stops this file passing vacuously if the paths ever move."""
    files = _sql_files()
    assert (SQL_ROOT / "schema.sql").exists()
    assert len(files) > 1, "no migrations found — check SQL_ROOT"


def test_tables_are_discovered():
    created, _ = _scan()
    assert "profiles" in created, "table scan found nothing — check CREATE_TABLE"


@pytest.mark.parametrize("table", sorted(_scan()[0]))
def test_every_table_is_granted_to_service_role(table):
    created, granted = _scan()
    assert table in granted, (
        f"Table '{table}' is created in {created[table]} but never granted to "
        f"service_role. Every read of it will fail with 42501 "
        f"'permission denied for table {table}' against a real database, "
        f"which reaches the client as a 500. Add:\n"
        f"    grant all on table public.{table} to service_role;"
    )
