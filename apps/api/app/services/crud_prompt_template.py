import uuid

from alexandria_core.models.prompt_template import PromptTemplate
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.prompt_template import PromptTemplateCreate, PromptTemplateUpdate

# The six built-in library prompts. Content (name/category/description/icon +
# body) copied verbatim from ``apps/web/lib/prompt-library-data.ts`` so the
# library is non-empty on a fresh install. Seeded idempotently by name.
BUILTIN_PROMPT_TEMPLATES: list[dict[str, str]] = [
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


async def create_prompt_template(
    db: AsyncSession, data: PromptTemplateCreate
) -> PromptTemplate:
    """Create a USER template. ``is_builtin`` is forced False, ``uses`` to 0."""
    template = PromptTemplate(**data.model_dump(), is_builtin=False, uses=0)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def get_prompt_template(
    db: AsyncSession, template_id: uuid.UUID
) -> PromptTemplate | None:
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    return result.scalar_one_or_none()


async def list_prompt_templates(
    db: AsyncSession, category: str | None = None
) -> list[PromptTemplate]:
    """List templates — builtins first, then user templates; each group oldest-first."""
    query = select(PromptTemplate)
    if category is not None:
        query = query.where(PromptTemplate.category == category)
    # Builtins first (is_builtin DESC), then stable by creation order.
    query = query.order_by(
        PromptTemplate.is_builtin.desc(), PromptTemplate.created_at
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_prompt_template(
    db: AsyncSession, template: PromptTemplate, data: PromptTemplateUpdate
) -> PromptTemplate:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_prompt_template(db: AsyncSession, template: PromptTemplate) -> None:
    await db.delete(template)
    await db.commit()


async def increment_prompt_template_uses(
    db: AsyncSession, template_id: uuid.UUID
) -> int | None:
    """Atomically increment ``uses`` and return the new count.

    A single ``UPDATE ... SET uses = uses + 1 ... RETURNING uses`` — never a
    read-modify-write on a loaded instance, so two concurrent applications can
    not lose an increment. Returns ``None`` when the template does not exist
    (0 rows matched; nothing is committed). Builtins are deliberately
    incrementable — usage tracking is not an edit.
    """
    result = await db.execute(
        update(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .values(uses=PromptTemplate.uses + 1)
        .returning(PromptTemplate.uses)
    )
    new_uses = result.scalar_one_or_none()
    if new_uses is None:
        return None
    await db.commit()
    return new_uses


async def seed_builtin_prompt_templates(db: AsyncSession) -> int:
    """Idempotently upsert the built-in templates by ``name``.

    Re-running never duplicates: an existing builtin with the same name is
    refreshed (category/description/body/icon) rather than re-inserted. Returns
    the number of NEW rows inserted.
    """
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.is_builtin.is_(True))
    )
    existing = {t.name: t for t in result.scalars().all()}

    inserted = 0
    for spec in BUILTIN_PROMPT_TEMPLATES:
        current = existing.get(spec["name"])
        if current is None:
            db.add(
                PromptTemplate(
                    name=spec["name"],
                    category=spec["category"],
                    description=spec["description"],
                    body=spec["body"],
                    icon_key=spec["icon_key"],
                    is_builtin=True,
                    uses=0,
                )
            )
            inserted += 1
        else:
            current.category = spec["category"]
            current.description = spec["description"]
            current.body = spec["body"]
            current.icon_key = spec["icon_key"]
    await db.commit()
    return inserted
