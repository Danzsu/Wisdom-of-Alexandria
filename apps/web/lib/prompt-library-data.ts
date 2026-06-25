/**
 * Seeded Prompt Library content (DESIGN-C).
 *
 * These six prompts are LOCAL seed/example data — there is no prompts backend
 * yet (creating prompts is an honest stub). Each entry copies its
 * name/category/description/usage verbatim from the Claude Design canvas
 * (`Alexandria.dc.html`, prompt data block) and adds a short illustrative
 * Hungarian `template` body with `{token}` placeholders for the detail modal.
 *
 * Kept serializable on purpose: `iconKey` is a plain string mapped to a
 * `lucide-react` icon in the component (`prompt-library-screen.tsx`), never an
 * imported component here.
 */
export interface PromptTemplate {
  /** Stable kebab-case slug (React key + test target). */
  id: string;
  /** Display name (verbatim from the design). */
  name: string;
  /** Category label rendered as a pill (verbatim). */
  cat: string;
  /** One-line muted description (verbatim). */
  desc: string;
  /** Usage count as a string (verbatim). */
  uses: string;
  /** Maps to a lucide icon in the component (NOT a component reference). */
  iconKey: "sparkles" | "refresh" | "eye" | "brain" | "check";
  /** Illustrative prompt body shown read-only in the detail modal. */
  template: string;
}

export const PROMPT_LIBRARY: readonly PromptTemplate[] = [
  {
    id: "folytatas-alap",
    name: "Folytatás — alap",
    cat: "Írás",
    desc: "A jelenet természetes folytatása a stíluslap és az előző bekezdés alapján.",
    uses: "142",
    iconKey: "sparkles",
    template: [
      "Folytasd a jelenetet egyetlen, természetes bekezdéssel.",
      "Tartsd a {stiluslap} hangvételét és az {elozo_bekezdes} ritmusát.",
      "Ne zárd le a jelenetet, ne ugorj időben — csak vezesd tovább.",
    ].join("\n"),
  },
  {
    id: "atiras-irodalmibb",
    name: "Átírás — irodalmibb",
    cat: "Átírás",
    desc: "A kijelölt szöveg emelt, irodalmi hangvételű újraírása a karakterhang megtartásával.",
    uses: "88",
    iconKey: "refresh",
    template: [
      "Írd át a kijelölt részt emeltebb, irodalmi hangvételűre.",
      "Őrizd meg {karakter} beszédmódját és a {stiluslap} szabályait.",
      "Kerüld az angolos mondatszerkezeteket és a modorosságot.",
    ].join("\n"),
  },
  {
    id: "erzeki-leiras",
    name: "Érzéki leírás",
    cat: "Leírás",
    desc: "Hat csatorna: látás, hang, tapintás, szag, íz, metafora — kártyánként.",
    uses: "67",
    iconKey: "eye",
    template: [
      "Gazdagítsd a kijelölt jelenetet érzéki részletekkel.",
      "Adj egy-egy javaslatot csatornánként: látás, hang, tapintás, szag, íz, metafora.",
      "Igazodj a {helyszin} hangulatához és az {elozo_bekezdes} képeihez.",
    ].join("\n"),
  },
  {
    id: "parbeszed-termeszetesites",
    name: "Párbeszéd természetesítés",
    cat: "Dialógus",
    desc: "Magyar beszélt nyelvhez igazítás, tegezés/magázás figyelembevételével.",
    uses: "54",
    iconKey: "brain",
    template: [
      "Tedd természetesebbé a kijelölt párbeszédet a magyar beszélt nyelvhez.",
      "Tartsd be {karakter} megszólítási formáját (tegezés/magázás).",
      "Hagyd meg a jelentést, csak a megfogalmazást finomítsd.",
    ].join("\n"),
  },
  {
    id: "otteleles-fordulatok",
    name: "Ötletelés — fordulatok",
    cat: "Brainstorm",
    desc: "Alternatív cselekményirányok, konfliktusok és tét-emelő fordulatok.",
    uses: "39",
    iconKey: "brain",
    template: [
      "Adj három alternatív cselekményirányt a jelenlegi helyzetből.",
      "Vedd figyelembe a {cselekmenyszal} tétjét és {karakter} motivációját.",
      "Minden ötlethez írj egy mondatos indoklást, miért emeli a tétet.",
    ].join("\n"),
  },
  {
    id: "magyar-nyelvi-ellenorzes",
    name: "Magyar nyelvi ellenőrzés",
    cat: "Szerkesztés",
    desc: "Angolos szerkezetek, modorosság és ismétlés kiszűrése.",
    uses: "31",
    iconKey: "check",
    template: [
      "Ellenőrizd a kijelölt szöveget magyar nyelvhelyesség szempontjából.",
      "Jelöld az angolos szerkezeteket, a modorosságot és az ismétléseket.",
      "Tartsd meg a {stiluslap} szóhasználatát; csak javaslatokat adj.",
    ].join("\n"),
  },
] as const;
