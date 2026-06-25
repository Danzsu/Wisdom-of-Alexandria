"""add_prompt_templates_table

Revision ID: b3c5d7e9f1a2
Revises: a8c4e1f2b3d4
Create Date: 2026-06-25 16:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Adds the user-facing Prompt Library:

  - Creates the GLOBAL ``prompt_templates`` table (no ``project_id`` — the
    library is workspace-wide). This is the browsable/creatable catalogue for the
    "Prompt könyvtár" screen, NOT the internal AI system prompts in
    ``packages/prompts``.
  - Seeds the six built-in templates (``is_builtin=True``) so the library is not
    empty on a fresh install. The seed is IDEMPOTENT: a builtin whose ``name``
    already exists is left untouched (no duplicate insert), so re-running
    ``upgrade`` never multiplies rows.

Portability:
  - The table has no foreign keys, so ``op.create_table`` is fully portable on
    PostgreSQL and the SQLite test database (matching ``c3a1b2c3d4e5``).
  - ``prompt_templates`` is registered in the initial-schema migration's
    ``_TABLES_ADDED_LATER`` set so it is created EXACTLY ONCE, here.
  - The SQLite test tier builds the schema from the models via ``create_all`` and
    never runs this migration; tests seed builtins through the
    ``seed_builtin_prompt_templates`` service in a fixture instead.

Verified: ``alembic upgrade head`` + ``downgrade -1`` + ``upgrade head`` run
clean on SQLite, and the seed is idempotent across repeated upgrades.
"""
import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c5d7e9f1a2"
down_revision: str | Sequence[str] | None = "a8c4e1f2b3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Built-in seed specs (name/category/description/icon/body). Kept in sync with
# ``app.services.crud_prompt_template.BUILTIN_PROMPT_TEMPLATES`` and
# ``apps/web/lib/prompt-library-data.ts``.
_BUILTINS: list[dict[str, str]] = [
    {
        "name": "Folytatás — alap",
        "category": "Írás",
        "description": (
            "A jelenet természetes folytatása a stíluslap és az előző bekezdés "
            "alapján."
        ),
        "icon_key": "sparkles",
        "body": (
            "Folytasd a jelenetet egyetlen, természetes bekezdéssel.\n"
            "Tartsd a {stiluslap} hangvételét és az {elozo_bekezdes} ritmusát.\n"
            "Ne zárd le a jelenetet, ne ugorj időben — csak vezesd tovább."
        ),
    },
    {
        "name": "Átírás — irodalmibb",
        "category": "Átírás",
        "description": (
            "A kijelölt szöveg emelt, irodalmi hangvételű újraírása a "
            "karakterhang megtartásával."
        ),
        "icon_key": "refresh",
        "body": (
            "Írd át a kijelölt részt emeltebb, irodalmi hangvételűre.\n"
            "Őrizd meg {karakter} beszédmódját és a {stiluslap} szabályait.\n"
            "Kerüld az angolos mondatszerkezeteket és a modorosságot."
        ),
    },
    {
        "name": "Érzéki leírás",
        "category": "Leírás",
        "description": (
            "Hat csatorna: látás, hang, tapintás, szag, íz, metafora — kártyánként."
        ),
        "icon_key": "eye",
        "body": (
            "Gazdagítsd a kijelölt jelenetet érzéki részletekkel.\n"
            "Adj egy-egy javaslatot csatornánként: látás, hang, tapintás, szag, "
            "íz, metafora.\n"
            "Igazodj a {helyszin} hangulatához és az {elozo_bekezdes} képeihez."
        ),
    },
    {
        "name": "Párbeszéd természetesítés",
        "category": "Dialógus",
        "description": (
            "Magyar beszélt nyelvhez igazítás, tegezés/magázás "
            "figyelembevételével."
        ),
        "icon_key": "brain",
        "body": (
            "Tedd természetesebbé a kijelölt párbeszédet a magyar beszélt "
            "nyelvhez.\n"
            "Tartsd be {karakter} megszólítási formáját (tegezés/magázás).\n"
            "Hagyd meg a jelentést, csak a megfogalmazást finomítsd."
        ),
    },
    {
        "name": "Ötletelés — fordulatok",
        "category": "Brainstorm",
        "description": (
            "Alternatív cselekményirányok, konfliktusok és tét-emelő fordulatok."
        ),
        "icon_key": "brain",
        "body": (
            "Adj három alternatív cselekményirányt a jelenlegi helyzetből.\n"
            "Vedd figyelembe a {cselekmenyszal} tétjét és {karakter} "
            "motivációját.\n"
            "Minden ötlethez írj egy mondatos indoklást, miért emeli a tétet."
        ),
    },
    {
        "name": "Magyar nyelvi ellenőrzés",
        "category": "Szerkesztés",
        "description": "Angolos szerkezetek, modorosság és ismétlés kiszűrése.",
        "icon_key": "check",
        "body": (
            "Ellenőrizd a kijelölt szöveget magyar nyelvhelyesség szempontjából.\n"
            "Jelöld az angolos szerkezeteket, a modorosságot és az ismétléseket.\n"
            "Tartsd meg a {stiluslap} szóhasználatát; csak javaslatokat adj."
        ),
    },
]


def _prompt_templates_table() -> sa.Table:
    """A lightweight Core table handle for the idempotent seed insert."""
    return sa.table(
        "prompt_templates",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("category", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("body", sa.Text()),
        sa.column("uses", sa.Integer()),
        sa.column("is_builtin", sa.Boolean()),
        sa.column("icon_key", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "is_builtin", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("icon_key", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_prompt_templates_category",
        "prompt_templates",
        ["category"],
        unique=False,
    )

    # Idempotent seed of the six builtins (skip names already present).
    bind = op.get_bind()
    table = _prompt_templates_table()
    existing_names = {
        row[0]
        for row in bind.execute(
            sa.select(table.c.name).where(table.c.is_builtin.is_(True))
        )
    }
    now = datetime.now(timezone.utc)
    rows = [
        {
            "id": uuid.uuid4(),
            "name": spec["name"],
            "category": spec["category"],
            "description": spec["description"],
            "body": spec["body"],
            "uses": 0,
            "is_builtin": True,
            "icon_key": spec["icon_key"],
            "created_at": now,
            "updated_at": now,
        }
        for spec in _BUILTINS
        if spec["name"] not in existing_names
    ]
    if rows:
        op.bulk_insert(table, rows)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_prompt_templates_category", table_name="prompt_templates")
    op.drop_table("prompt_templates")
