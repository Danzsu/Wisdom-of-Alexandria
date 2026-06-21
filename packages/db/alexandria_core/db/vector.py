"""Dialect-aware pgvector column type.

The RAG feature stores embedding vectors. PostgreSQL gets a real ``vector(N)``
column (via the ``pgvector`` package) so it can use an ANN index + the cosine
distance operator. The SQLite test database — built with
``Base.metadata.create_all`` (not Alembic) and used for the non-postgres test
tier — has no such type, so the same column must degrade gracefully to ``JSON``.

``Vector`` below is a single ``TypeDecorator`` that:

- compiles to ``vector(<dim>)`` DDL on PostgreSQL (delegating to
  ``pgvector.sqlalchemy.Vector``) and to ``JSON`` on SQLite,
- binds a ``list[float]`` to the pgvector representation on PG and to a JSON
  array on SQLite,
- always returns a plain ``list[float]`` on read (NOT a numpy ``ndarray``),
  so callers and tests get a stable, JSON-serializable Python type on both
  backends.

``cosine_distance(column, query)`` produces the ordering expression used by the
B2b retrieval query. On PostgreSQL it emits the ``<=>`` operator against a
casted vector literal. It is PostgreSQL-only by design — the SQLite tier does
not run similarity search (those tests are ``@pytest.mark.postgres``).
"""

from __future__ import annotations

from collections.abc import Sequence

from pgvector.sqlalchemy import Vector as _PGVector
from sqlalchemy import JSON, Float
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.types import TypeDecorator

# Default embedding width recommendation: OpenAI ``text-embedding-3-small``
# (1536-dim). Kept here as the canonical place the column dimension is sourced.
DEFAULT_EMBEDDING_DIM = 1536


def _to_float_list(value: object) -> list[float] | None:
    """Coerce a stored/loaded vector value into a plain ``list[float]``.

    Handles the pgvector numpy ``ndarray`` result, a JSON-decoded list (SQLite),
    and a None. Anything iterable of numbers is normalized; ``None`` passes
    through unchanged so a nullable column reads back as ``None`` rather than an
    empty list (which would be a silent, lossy substitution).
    """
    if value is None:
        return None
    # numpy ndarray (pgvector result) exposes ``tolist``; use it when present.
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        return [float(x) for x in tolist()]
    if isinstance(value, (list, tuple)):
        return [float(x) for x in value]
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return [float(x) for x in value]
    # Unknown shape: fail loudly rather than silently storing garbage.
    raise TypeError(f"Cannot coerce {type(value).__name__} to list[float] for Vector column")


class Vector(TypeDecorator):
    """Portable embedding column: ``vector(dim)`` on PG, ``JSON`` on SQLite.

    ``cache_ok`` is True: the type is fully described by ``dim`` (an int), so
    SQLAlchemy may safely cache compiled statements that use it.
    """

    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = DEFAULT_EMBEDDING_DIM):
        self.dim = dim
        super().__init__()

    def load_dialect_impl(self, dialect):
        # PostgreSQL -> real pgvector column; everything else -> JSON.
        if dialect.name == "postgresql":
            return dialect.type_descriptor(_PGVector(self.dim))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        # Same on every backend: coerce to a plain list[float]. On PostgreSQL the
        # underlying pgvector type (selected in load_dialect_impl) turns that list
        # into its wire format; on SQLite it is stored as a JSON array.
        return None if value is None else _to_float_list(value)

    def process_result_value(self, value, dialect):
        # Normalize both the pgvector ndarray (PG) and the JSON list (SQLite)
        # back to a plain list[float] on every backend.
        return _to_float_list(value)


def cosine_distance(column: ColumnElement, query: Sequence[float]) -> ColumnElement:
    """Cosine-distance ordering expression for similarity search (PG-only).

    Emits ``embedding <=> :q`` on PostgreSQL, where ``:q`` is the query vector
    bound as a ``list[float]`` and typed with the column's own ``Vector`` type —
    so its bind chain (``process_bind_param`` -> the pgvector wire format)
    renders the RHS, exactly as pgvector's native ``cosine_distance`` comparator
    does. The B2b retrieval query orders ascending by this (0 = identical).

    Binding a list (NOT a pre-stringified ``"[...]"`` literal) is essential: the
    literal would be re-processed by ``process_bind_param`` -> ``_to_float_list``
    and rejected as a ``str``. Not supported on SQLite; the similarity tests that
    use it are ``@pytest.mark.postgres``.
    """
    return column.op("<=>", return_type=Float)(list(query))
