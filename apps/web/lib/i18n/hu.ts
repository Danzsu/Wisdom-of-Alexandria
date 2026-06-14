/**
 * Hungarian microcopy used by the app shell + navigation.
 *
 * Every string is copied VERBATIM from the prototype
 * (`wisdom-of-alexandria-ui-ux/project/Alexandria App.dc.html`). Never invent
 * translations — if a label is missing from the prototype it must be sourced
 * before use.
 */
export const hu = {
  brand: "Alexandria",
  brandFull: "Wisdom of Alexandria",
  project: {
    /** The single demo project name used while data fetching is stubbed (M3 fills). */
    demoTitle: "A Fárosz őrzője",
    author: "Kovács Lilla",
  },
  user: {
    name: "Kovács Lilla",
    email: "lilla@alexandria.app",
    initials: "KL",
    profile: "Profil",
    logout: "Kijelentkezés",
  },
  topbar: {
    projectsAria: "Projektek",
    searchAria: "Keresés",
    themeAria: "Téma váltása",
    settingsAria: "Beállítások",
    userMenuAria: "Felhasználói menü",
    shareAria: "Megosztás",
    shareTitle: "Megosztás / társszerzők",
    /** Centered scene breadcrumb on the Write route. */
    breadcrumbChapter: "II. fejezet",
    breadcrumbScene: "3. jelenet — Rejtett jelek",
  },
  /** Icon-rail workspace destinations. */
  nav: {
    attekintes: "Áttekintés",
    terv: "Terv",
    iras: "Írás",
    codex: "Codex",
    idosor: "Idősor",
    kapcsolatok: "Kapcsolatok",
    cselekmenyszalak: "Cselekményszálak",
    chat: "Chat",
    export: "Export",
    tools: "Eszközök",
  },
  /** Tools flyout entries. */
  tools: {
    sectionAnalysis: "Elemzés",
    sectionStores: "Tárak",
    review: "Áttekintés",
    jobs: "AI feladatok",
    prompts: "Prompt Library",
    audio: "Hangkönyvtár",
  },
  statusbar: {
    saved: "Mentve",
    // M4 placeholder — live word count arrives with the editor.
    wordCountPlaceholder: "1 482 szó",
    // M4 placeholder — live chapter/scene location arrives with the editor.
    locationPlaceholder: "II. fejezet, 3. jelenet",
  },
  command: {
    placeholder: "Keresés a projektben… jelenetek, Codex, műveletek",
    escHint: "Esc",
    groupScenes: "Jelenetek",
    groupCodex: "Codex",
    groupActions: "Műveletek",
    noResultsPrefix: "Nincs találat erre: ",
    noResultsHint:
      "Próbálj más kulcsszót, vagy hozz létre új jelenetet / Codex-bejegyzést ezzel a névvel.",
    create: "Létrehozás",
    actionExport: "Exportálás…",
    actionTheme: "Téma váltása",
  },
  toast: {
    comingSoon: "Hamarosan",
  },
} as const;

export type Hu = typeof hu;
