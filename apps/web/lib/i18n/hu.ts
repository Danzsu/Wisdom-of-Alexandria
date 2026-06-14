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
    cleanWrite: "Tiszta írás",
    export: "Export",
    settings: "Beállítások",
    tools: "Eszközök",
  },
  /** Tools flyout entries. */
  tools: {
    sectionAnalysis: "Elemzés",
    sectionStores: "Tárak",
    review: "Áttekintés",
    timeline: "Idősor",
    relations: "Kapcsolatok",
    subplots: "Cselekményszálak",
    jobs: "AI feladatok",
    prompts: "Prompt Library",
    audio: "Hangkönyvtár",
  },
  statusbar: {
    saved: "Mentve",
    saving: "Mentés…",
    error: "Mentés sikertelen",
    // M4 placeholder — live word count arrives with the editor.
    wordCountPlaceholder: "1 482 szó",
    // M4 placeholder — live chapter/scene location arrives with the editor.
    locationPlaceholder: "II. fejezet, 3. jelenet",
    /** Word-count suffix; n is already a localized number string. */
    wordCount: (n: string) => `${n} szó`,
    /** Suffix on the model badge for local (Ollama) inference. */
    modelLocalSuffix: "— lokális",
  },
  /** Write View (`Write View` prototype screen + in-app writechrome). */
  write: {
    chaptersHeading: "Fejezetek",
    newChapterAria: "Új fejezet",
    treeLoading: "Fejezetek betöltése…",
    treeError: "Nem sikerült betölteni a fejezeteket",
    treeEmpty: "Még nincs fejezet ebben a könyvben.",
    sceneEmpty: "Nincs jelenet ebben a fejezetben.",
    sceneFallbackTitle: "Névtelen jelenet",
    /** Scene fetch states. */
    sceneLoading: "Jelenet betöltése…",
    sceneError: "Nem sikerült betölteni a jelenetet",
    sceneNotFound: "A jelenet nem található ebben a könyvben.",
    retry: "Újrapróbálkozás",
    // Toolbar groups + actions.
    write: "Írás",
    describe: "Leírás",
    rewrite: "Átírás",
    brainstorm: "Ötletelés",
    more: "Több",
    format: "Formátum",
    groupAi: "AI",
    groupCodex: "Codex",
    groupFormatting: "Formázás",
    sceneBeat: "Jelenet beat",
    sceneBeatHint: "Kulcsmoment a cselekményben",
    continueWriting: "Folytatás írása",
    continueWritingHint: "Új beat azonnali generálással",
    codexProgression: "Codex progresszió",
    codexProgressionHint: "Fejlődés rögzítése a történetben",
    versionHistory: "Verzióelőzmények",
    thesaurus: "Tezaurusz",
    visualization: "Vizualizáció",
    // Format menu.
    fmFontHeading: "Betűtípus",
    fmFontLiterata: "Literata",
    fmFontLiterataHint: "szépirodalmi",
    fmFontSans: "Source Sans",
    fmFontSansHint: "letisztult",
    fmFontSystem: "Rendszer",
    fmFontSystemHint: "gyors",
    fmSizeLabel: "Betűméret",
    fmSizeDownAria: "Kisebb",
    fmSizeUpAria: "Nagyobb",
    fmWidthHeading: "Hasábszélesség",
    fmWidthNarrow: "Keskeny",
    fmWidthNormal: "Normál",
    fmWidthWide: "Széles",
    fmSpacingHeading: "Sorköz",
    fmSpacingTight: "Tömör",
    fmSpacingLoose: "Lazább",
    fmSpacingDouble: "Dupla",
    fmSeparatorLabel: "Jelenetelválasztó",
    fmSeparatorModify: "Módosítás",
    // Toolbar icon buttons.
    focusAria: "Fókusz mód",
    focusTitle: "Fókusz mód (zavarmentes írás)",
    commentAria: "Megjegyzés",
    commentTitle: "Megjegyzés a kijelöléshez",
    insertImageAria: "Kép helye",
    insertImageTitle: "Kép helye beszúrása",
    insertTableAria: "Táblázat",
    insertTableTitle: "Táblázat beszúrása",
    sceneMenuAria: "Jelenet műveletek",
    sceneMenuTitle: "Jelenet műveletek",
    historyAria: "Verzióelőzmények",
    historyTitle: "Verzióelőzmények",
    // Scene kebab menu.
    scSummarize: "Jelenet összefoglalása",
    scDetect: "Karakterek felismerése",
    scChat: "Chat a jelenettel",
    scSubtitle: "Alcím hozzáadása",
    scDuplicate: "Jelenet duplikálása",
    scExport: "Jelenet exportálása",
    // Clean-write banner.
    cleanWriteTitle: "Tiszta írás mód",
    cleanWriteHint: "— csak te és a szöveg, AI nélkül.",
    cleanWriteEnableAi: "AI bekapcsolása",
    // Plain formatting bar (clean-write).
    fmtH1Title: "Címsor 1",
    fmtH2Title: "Címsor 2",
    fmtBody: "Törzs",
    fmtBodyTitle: "Törzsszöveg",
    fmtBoldTitle: "Félkövér (⌘B)",
    fmtItalicTitle: "Dőlt (⌘I)",
    fmtStrikeTitle: "Áthúzott",
    fmtBulletTitle: "Felsorolás",
    fmtNumberTitle: "Számozott lista",
    fmtQuoteTitle: "Idézet",
    fmtHighlightTitle: "Kiemelés",
    // Selection bubble menu.
    bubbleRewrite: "Átírás",
    bubbleDescribe: "Leírás",
    bubbleExpand: "Bővítés",
    bubbleVisualize: "Vizualizáció",
    bubbleAiAria: "AI generálás",
    bubbleCodex: "Codexbe",
    bubbleAudioAria: "Hang csatolása",
    bubbleAudioTitle: "Hang csatolása",
    // Slash command.
    slashH1: "Címsor 1",
    slashH2: "Címsor 2",
    slashBold: "Félkövér",
    slashItalic: "Dőlt",
    slashQuote: "Idézet",
    slashSeparator: "Jelenetelválasztó",
    // Inline beat card.
    beatHiddenLabel: "Jelenet beat generálása",
    beatWordsSuffix: "szó",
    beatGenerate: "Beat generálása",
    beatGenerating: "Generálás folyamatban…",
    beatApply: "Alkalmaz",
    beatRetry: "Újra",
    beatDiscard: "Elvet",
    beatDiscardAria: "Beat elvetése",
    beatReadyMeta: (words: number, model: string) => `${words} szó · ${model}`,
    // Codex mention popover.
    mentionOpenInCodex: "Megnyitás a Codexben →",
    // Image placeholder (stub).
    imagePlaceholderTitle: "Kép helye — húzd ide, illeszd be, vagy tallózz",
    imagePlaceholderHint: "JPG / PNG / WebP · az EPUB-ba ágyazódik",
    imageCaptionPlaceholder: "Képaláírás (opcionális)…",
    imageLayoutFullAria: "Teljes szélesség",
    imageLayoutLeftAria: "Balra",
    imageLayoutRightAria: "Jobbra",
    imageRemoveAria: "Eltávolítás",
    // Editor accessible names (screen-reader labels for editor chrome).
    editorAria: "Kézirat szerkesztő",
    slashMenuAria: "Parancsmenü",
    bubbleMenuAria: "Kijelölés műveletei",
    audioMarkAria: "Hang",
    chapterTreeAria: "Fejezetek",
    // Manuscript table block (demo content + actions).
    tableLabel: "Táblázat",
    tableAddRowAria: "Sor hozzáadása",
    tableDeleteAria: "Táblázat törlése",
    tableColCharacter: "Szereplő",
    tableColGoal: "Cél",
    tableColObstacle: "Akadály",
    // Timeline rail.
    timelineLabel: "IDŐSOR",
    timelineAria: "Történet idősor",
    // Toolbar/word-count meta.
    saved: "Mentve",
    // Stubs / toasts (verbatim from the prototype handlers).
    toastM5: "Az AI-generálás az M5-ben érkezik",
    toastImagePlaceholder: "Kép helye — a feltöltés a V2-ben érkezik",
    toastImageInserted: "Kép helye beszúrva — húzd ide a képet",
    toastTableInserted: "Táblázat beszúrva",
    toastAudioPrototype: "Hang csatolása (prototípus)",
    toastComment: "Megjegyzés a kijelöléshez",
    toastCodexAdd: "Codexbe mentve (M6)",
    toastSummarize: "Jelenet összefoglalása folyamatban… (AI feladatok)",
    toastDetect: "Karakterek felismerése (M6)",
    toastSubtitle: "Alcím hozzáadva a jelenethez",
    toastDuplicate: "Jelenet duplikálva",
    toastExportScene: "Jelenet exportálva (M8)",
    toastHistory: "Verzióelőzmények (V1)",
    toastThesaurus: "Tezaurusz (V2)",
    toastVisualization: "Vizualizáció (V2)",
    toastSeparator: "Jelenetelválasztó módosítása (V2)",
    toastBeatApplied: "Beat alkalmazva — új revízióként mentve",
    toastBeatDiscarded: "Beat elvetve",
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
  /** App shell chrome (rail aria, AI inspector slot, codex sidebar placeholder). */
  shell: {
    /** Icon-rail accessible name. */
    railAria: "Munkaterület",
    /** AI inspector slot (Write route) accessible name. */
    aiInspectorAria: "AI segéd",
    /** AI inspector placeholder copy — the panel is filled in M5. */
    aiInspectorComingSoon: "Az AI segéd az M5-ben érkezik.",
    /** Codex list sidebar accessible name. */
    codexSidebarAria: "Codex",
    /** Codex list placeholder copy — the list is filled in M6. */
    codexComingSoon: "A Codex-lista az M6-ban érkezik.",
  },
  /** Reusable kit-component default labels. */
  kit: {
    /** ConfirmDialog default confirm label (destructive). */
    confirmDelete: "Végleges törlés",
    /** ConfirmDialog default cancel label. */
    cancel: "Mégse",
    /** AIResultCard copy-to-clipboard action. */
    copy: "Másolás",
    /** AIResultCard save-as-Snippet (star) action. */
    saveAsSnippet: "Mentés Snippetként",
    /** Theme toggle aria-label / title. */
    themeToggle: "Téma váltása",
  },
  /** Book-route placeholder screens (M2 verifiable nav; real screens later). */
  placeholders: {
    attekintesLabel: "Áttekintés",
    attekintesHint: "Az Áttekintés az M10-ben érkezik.",
    beallitasokLabel: "Beállítások",
    beallitasokHint: "A Beállítások az M8-ban érkezik.",
    chatLabel: "Chat",
    chatHint: "A Chat az M10-ben érkezik.",
    codexLabel: "Codex",
    codexHint: "A Codex az M6-ban érkezik.",
    cselekmenyszalakLabel: "Cselekményszálak",
    cselekmenyszalakHint: "A Cselekményszálak az M10-ben érkezik.",
    exportLabel: "Export",
    exportHint: "Az Export az M8-ban érkezik.",
    feladatokLabel: "AI feladatok",
    feladatokHint: "Az AI feladatok az M10-ben érkezik.",
    hangokLabel: "Hangkönyvtár",
    hangokHint: "A Hangkönyvtár az M11-ben (V2) érkezik.",
    idosorLabel: "Idősor",
    idosorHint: "Az Idősor az M10-ben érkezik.",
    kapcsolatokLabel: "Kapcsolatok",
    kapcsolatokHint: "A Kapcsolatok az M10-ben érkezik.",
    promptokLabel: "Prompt Library",
    promptokHint: "A Prompt Library az M10-ben érkezik.",
    tervLabel: "Terv",
    tervHint: "A Plan Board az M7-ben érkezik.",
  },
  /** Projektek dashboard (`showprojects` prototype screen). */
  projects: {
    onboardEyebrow: "Üdvözlünk az Alexandriában",
    onboardTitle: "Három lépés az első fejezetedig",
    onboardDismissAria: "Bezárás",
    onboardStep1Title: "Hozd létre a könyvet",
    onboardStep1Hint: "Cím, műfaj, nézőpont — egy perc az egész.",
    onboardStep2Title: "Töltsd fel a Codexet",
    onboardStep2Hint: "Szereplők, helyszínek — az AI ebből merít.",
    onboardStep3Title: "Írd meg az első jelenetet",
    onboardStep3Hint: "Te írod — az AI csak ha kéred, és sosem magától.",
    heroTitle: "Üdvözöl az Alexandria.",
    heroSubtitle: "Melyik történeteden dolgozol ma?",
    quickNewBook: "Új könyv",
    quickImport: "Kézirat importálása",
    quickCleanWrite: "Tiszta írás",
    quickPromptLibrary: "Prompt Library",
    sparkEyebrow: "A nap írói szikrája",
    sparkPrompt:
      "„Egy könyvtáros olyan tekercset talál, amely minden éjjel átírja önmagát.”",
    sparkCta: "Írok rá →",
    continueHeading: "Folytasd, ahol abbahagytad",
    allHeading: "Összes projekted",
    searchPlaceholder: "Keresés…",
    sortLabel: "Rendezés",
    sortRecent: "Legutóbbi",
    sortTitle: "Cím szerint",
    groupLabel: "Csoportosítás",
    groupNone: "Nincs",
    groupGenre: "Műfaj szerint",
    viewGrid: "Rács",
    viewList: "Lista",
    addProjectTitle: "Új projekt",
    addProjectHint: "vagy kézirat importálása (.docx, .md)",
    metaBooks: (n: number) => `${n} könyv`,
    /**
     * Hungarian relative-time label for a project's last-updated date, relative
     * to `now` (defaults to the call moment). Used on the cards instead of a
     * fabricated book count — only real `updated_at` data is shown.
     */
    relativeUpdated: (iso: string, now: Date = new Date()): string => {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return "";
      const diffMs = now.getTime() - then;
      const day = 86_400_000;
      const days = Math.floor(diffMs / day);
      if (days <= 0) return "Frissítve ma";
      if (days === 1) return "Frissítve tegnap";
      if (days < 7) return `Frissítve ${days} napja`;
      if (days < 30) {
        const weeks = Math.floor(days / 7);
        return `Frissítve ${weeks} hete`;
      }
      if (days < 365) {
        const months = Math.floor(days / 30);
        return `Frissítve ${months} hónapja`;
      }
      const years = Math.floor(days / 365);
      return `Frissítve ${years} éve`;
    },
    loadingAria: "Projektek betöltése",
    emptyTitle: "Még nincs projekted",
    emptyHint: "Hozd létre az első könyvedet, és kezdődhet az írás.",
    emptyCta: "Új könyv",
    errorTitle: "Nem sikerült betölteni a projekteket",
    errorRetry: "Újrapróbálkozás",
    importToast: "A kézirat importálása hamarosan érkezik",
    cleanWriteToast: "A tiszta írás mód hamarosan érkezik",
    sparkToast: "Az írói szikra hamarosan érkezik",
    promptLibraryToast: "A Prompt Library hamarosan érkezik",
    /** Shown when a project card is opened but the project has no book yet. */
    noBookInProject: "Nincs könyv ebben a projektben",
    /** Generic "opening project…" failure when the book lookup errors. */
    openProjectError: "Nem sikerült megnyitni a projektet",
  },
  /** Új könyv wizard (`wizon` prototype modal). */
  wizard: {
    dialogTitle: "Új könyv létrehozása",
    dialogDescription:
      "Add meg a könyv alapadatait, stílusát és nézőpontját három lépésben.",
    step1Eyebrow: "1. lépés — Alapadatok",
    step2Eyebrow: "2. lépés — Stílus és AI",
    step3Eyebrow: "3. lépés — Összegzés",
    coverAria: "Borító feltöltése",
    coverLabel: "borító",
    coverToast: "A borítófeltöltés hamarosan érkezik",
    titleLabel: "Cím",
    titlePlaceholder: "Az alexandriai hajnal",
    titleRequired: "A cím megadása kötelező.",
    authorLabel: "Szerző / írói név",
    genreLabel: "Műfaj",
    languageLabel: "Nyelv",
    languageHu: "Magyar",
    languageEn: "English",
    povLabel: "Nézőpont (POV)",
    povFirst: "1. személy",
    povThirdLimited: "3. személy (korlátozott)",
    povThirdOmniscient: "3. személy (mindentudó)",
    audienceLabel: "Célközönség",
    audienceAdult: "Felnőtt",
    audienceYa: "Ifjúsági (YA)",
    audienceChild: "Gyerek",
    lengthLabel: "Terjedelmi cél",
    length50: "50 000 szó",
    length80: "80 000 szó",
    length100: "100 000+ szó",
    styleLabel: "Stílusjegyek",
    stylePlaceholder: "Pl. lassú építkezés, érzéki leírások, rövid párbeszédek…",
    summaryTitle: "Cím",
    summaryAuthor: "Szerző",
    summaryGenre: "Műfaj",
    summaryLanguage: "Nyelv",
    summaryPov: "Nézőpont",
    summaryAudience: "Célközönség",
    summaryLength: "Terjedelmi cél",
    /** Suffix on summary rows whose value is collected but not yet persisted. */
    summaryNotSavedTag: "(később menthető / V1)",
    summaryNote: "A beállítások később bármikor módosíthatók a könyv beállításaiban.",
    back: "← Vissza",
    next: "Tovább →",
    create: "Könyv létrehozása",
    successToast: "A könyv létrejött",
    errorTitle: "Nem sikerült létrehozni a könyvet",
  },
  /** Genre options for the wizard Select (sourced from the prototype default). */
  genres: [
    "történelmi fantasy",
    "fantasy",
    "sci-fi",
    "krimi",
    "thriller",
    "romantikus",
    "novella",
    "ifjúsági",
    "kortárs",
  ],
} as const;

export type Hu = typeof hu;
