"""Opt-in demo seed — fills an EMPTY database with a small Hungarian sample.

New installs boot into a completely empty workspace; this script gives them a
browsable starting point: one demo project with a book, two chapters, a few
beat-annotated scenes and three Codex entries (character / location /
worldbuilding). All text is ORIGINAL demo content written for this seed.

Usage (repo root):

    uv run --directory apps/api python -m app.seed

or inside the running compose stack:

    docker compose exec api uv run --no-sync python -m app.seed

Guard: the seed is strictly a first-run convenience. If the database already
contains ANY project it no-ops with a message and touches nothing — running it
twice (or against a live workspace) is always safe.
"""

import asyncio
import logging

from alexandria_core.models import (
    Beat,
    Book,
    Chapter,
    Character,
    Location,
    Project,
    Scene,
    WorldbuildingEntry,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

DEMO_PROJECT_TITLE = "Demó — A tenger emlékezete"


def _build_demo_project() -> Project:
    """Assemble the full demo object graph (unpersisted).

    Built as one relationship-linked graph so a single ``session.add`` cascades
    every row, and the whole seed commits atomically.
    """
    project = Project(
        title=DEMO_PROJECT_TITLE,
        description=(
            "Bemutató projekt a Wisdom of Alexandria felfedezéséhez. "
            "Nyugodtan szerkeszd vagy töröld — minden tartalma minta."
        ),
        language="hu",
    )

    book = Book(
        title="A tenger emlékezete",
        author="Minta Szerző",
        genre="fantasy",
        language="hu",
        order_index=0,
        synopsis=(
            "Szélfogó-öböl halászai régóta tudják: amit a tenger elvesz, azt "
            "emlékként adja vissza. Lilla, a fiatal emlékőr egy apálykor "
            "partra sodort levélben a saját kézírására ismer — pedig sosem "
            "írta meg. A nyomok a dagálykönyvtár lezárt szintjére vezetnek, "
            "ahol a város legrégebbi emléke vár rá."
        ),
        description="Bemutató könyv — rövid fantasy minta magyar nyelven.",
        word_count_target=60000,
    )
    project.books.append(book)

    # --- 1. fejezet: két jelenet, beat-ekkel -------------------------------
    chapter1 = Chapter(
        title="Az apály ajándéka",
        summary="Lilla hajnali őrsége során a tenger egy lehetetlen levelet ad vissza.",
        order_index=0,
    )
    book.chapters.append(chapter1)

    scene1 = Scene(
        title="Hajnali őrség a mólón",
        order_index=0,
        summary=(
            "Lilla az emlékőrök hajnali szertartását végzi, amikor az apály "
            "furcsán korán érkezik."
        ),
        content=(
            "A móló kövei még őrizték az éjszaka hidegét, amikor Lilla "
            "meggyújtotta az első emléklámpást. A víz szokatlanul csendes "
            "volt — az a fajta csend, amelyről a nagyanyja azt mondta: "
            "ilyenkor a tenger gondolkodik.\n\n"
            "Az apály aznap egy órával korábban jött, mint a dagálykönyv "
            "ígérte. Lilla a nedves fövenyen lépkedett a jelzőkövek között, "
            "és számolta, mit hagyott hátra a víz: három kagylót, egy "
            "megfakult hálódarabot — és egy viaszpecsétes levelet, amely "
            "száraz volt, mintha sosem ért volna hullámhoz."
        ),
    )
    scene1.beats.extend(
        [
            Beat(
                order_index=0,
                description="Lilla meggyújtja az emléklámpásokat a hajnali szertartás szerint.",
            ),
            Beat(
                order_index=1,
                description=(
                    "Az apály a dagálykönyv jóslatánál korábban érkezik — "
                    "első jele, hogy valami elmozdult."
                ),
            ),
            Beat(
                order_index=2,
                description="A fövenyen egy teljesen száraz, viaszpecsétes levél hever.",
            ),
        ]
    )
    chapter1.scenes.append(scene1)

    scene2 = Scene(
        title="A levél, amit sosem írt meg",
        order_index=1,
        summary=(
            "A levél Lilla saját kézírásával íródott — egy olyan napról, "
            "amely még nem történt meg."
        ),
        content=(
            "A pecsét idegen volt, a kézírás nem. Lilla a saját betűit "
            "nézte: a jellegzetes, balra dőlő t-áthúzásokat, amelyekért az "
            "írnokmester annyiszor megszidta.\n\n"
            "„A dagálykönyvtár kilencedik szintjén keresd — ott őrzik, amit "
            "a város felejteni fizetett.” Aláírás nem volt. Csak egy dátum, "
            "két héttel a jövőben."
        ),
    )
    scene2.beats.extend(
        [
            Beat(order_index=0, description="Lilla felismeri a saját kézírását a levélben."),
            Beat(
                order_index=1,
                description=(
                    "A levél a dagálykönyvtár lezárt kilencedik szintjére "
                    "hívja — a dátum a jövőre mutat."
                ),
            ),
        ]
    )
    chapter1.scenes.append(scene2)

    # --- 2. fejezet: egy jelenet ------------------------------------------
    chapter2 = Chapter(
        title="A dagálykönyvtár",
        summary=(
            "Lilla belép a dagálykönyvtárba, hogy a lezárt kilencedik szint "
            "nyomába eredjen."
        ),
        order_index=1,
    )
    book.chapters.append(chapter2)

    scene3 = Scene(
        title="A kilencedik szint küszöbén",
        order_index=0,
        summary=(
            "A könyvtár emlékpolcai között Lilla megtalálja a lefelé vezető, "
            "sóval lepecsételt lépcsőt."
        ),
        content=(
            "A dagálykönyvtárban nem papírt őriztek, hanem üvegfiolákat: "
            "minden polcon egy-egy visszaadott emlék derengett halvány, "
            "tengerzöld fénnyel. Lilla a katalógusterem mögött találta meg "
            "a lépcsőt, amelyről a térképek hallgattak — a fokokat vastag "
            "sókéreg pecsételte le, ahogy a tiltott szinteket szokás."
        ),
    )
    scene3.beats.extend(
        [
            Beat(
                order_index=0,
                description="A könyvtár fiolapolcai: a visszaadott emlékek tárolása.",
            ),
            Beat(
                order_index=1,
                description="Lilla megtalálja a sóval lepecsételt lépcsőt a kilencedik szint felé.",
            ),
        ]
    )
    chapter2.scenes.append(scene3)

    # --- Codex: karakter / helyszín / világépítés --------------------------
    project.characters.append(
        Character(
            name="Lilla",
            aliases=["az emlékőr", "Lil"],
            role="protagonista",
            description=(
                "Tizenkilenc éves emlékőr-tanonc Szélfogó-öbölben; ő olvassa "
                "hajnalonta az apály hagyatékát."
            ),
            personality=(
                "Kíváncsi és módszeres; hamarabb kérdez, mint amennyire a "
                "szabályzat engedi."
            ),
            appearance="Sótól kifakult copf, a bal csuklóján az emlékőrök kék zsinórja.",
        )
    )
    project.locations.append(
        Location(
            name="Szélfogó-öböl",
            description=(
                "Sziklakarok közé épült kikötőváros, ahol az élet a "
                "dagálykönyv ritmusát követi."
            ),
            geography="Két sziklanyúlvány öleli az öblöt; a dagálykönyvtár a keleti karon áll.",
            atmosphere="Sószag, harangszó, és a mólókon derengő emléklámpások.",
        )
    )
    project.worldbuilding_entries.append(
        WorldbuildingEntry(
            name="Az emlékdagály",
            category="mágia",
            description=(
                "A tenger nem tárgyakat sodor partra, hanem emlékeket: amit "
                "a víz elnyel, azt egyszer emlék formájában adja vissza. Az "
                "emlékőrök tiszte, hogy a visszatérő emlékeket hajnalonta "
                "összegyűjtsék és a dagálykönyvtárban fiolába zárják."
            ),
        )
    )

    return project


async def seed_demo(session: AsyncSession) -> bool:
    """Seed the demo content. Returns True if seeded, False if it no-opped.

    Idempotence guard: any pre-existing project (demo or real) means the
    workspace is not a fresh install, so nothing is written.
    """
    existing_project_id = await session.scalar(select(Project.id).limit(1))
    if existing_project_id is not None:
        logger.info("seed: database already has a project - nothing to do")
        return False

    session.add(_build_demo_project())
    await session.commit()
    logger.info("seed: demo project created (%s)", DEMO_PROJECT_TITLE)
    return True


async def main() -> None:
    # Imported here (not module level) so importing app.seed in tests never
    # requires a reachable DATABASE_URL engine.
    from alexandria_core.db.session import AsyncSessionLocal, engine

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        async with AsyncSessionLocal() as session:
            created = await seed_demo(session)
    finally:
        await engine.dispose()

    if created:
        print(f'Demo seed kesz: "{DEMO_PROJECT_TITLE}" letrehozva.')
    else:
        print("A demo seed nem futott le: az adatbazis mar tartalmaz projektet (no-op).")


if __name__ == "__main__":
    asyncio.run(main())
