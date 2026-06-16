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
  /** Modal/dialog shared microcopy. */
  modal: {
    /**
     * Screen-reader-only fallback title for a dialog that supplies neither a
     * `title` prop nor a `ModalHeader`. Never visible; exists only so the
     * dialog can never be nameless for assistive tech.
     */
    untitledFallback: "Párbeszédablak",
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
    /** Aria-label on the Tools button's failed-job badge (n = count). */
    jobsBadgeAria: (n: number) => `${n} sikertelen AI feladat`,
  },
  /**
   * AI feladatok screen (B1) — the live generation-jobs list. Reads the real
   * GenerationJob records the (synchronous) AI actions persist; surfaces status,
   * context and any failure. Status / job-type labels degrade gracefully on an
   * unknown value (raw string fallback, never a crash).
   */
  jobs: {
    title: "AI feladatok",
    subtitle: "A könyvhöz tartozó AI generálások előzménye és állapota.",
    /** Status pill labels (backend JobStatus: pending/running/done/failed). */
    statusPending: "Várakozik",
    statusRunning: "Folyamatban",
    statusDone: "Kész",
    statusFailed: "Sikertelen",
    /** Job-type labels (backend job_type values). */
    typeRewrite: "Átírás",
    typeDescribe: "Érzéki leírás",
    typeGenerateScene: "Jelenet generálása",
    typeWriteContinue: "Folytatás",
    typeSummarize: "Összefoglalás",
    /** Context line: which scene/chapter the job belongs to. */
    contextScene: "Jelenet",
    contextChapter: "Fejezet",
    contextNone: "Nincs jelenethez kötve",
    /** Model + prompt-version meta line. */
    modelLabel: "Modell",
    promptVersionLabel: "Prompt verzió",
    /** Expandable error block on a failed job. */
    errorHeading: "Hibaüzenet",
    errorToggleShow: "Hibaüzenet megjelenítése",
    errorToggleHide: "Hibaüzenet elrejtése",
    errorUnknown: "Ismeretlen hiba történt.",
    /** Loading / empty / error screen states. */
    loadingAria: "AI feladatok betöltése",
    emptyTitle: "Nincs még AI feladat",
    emptyHint:
      "Amint az AI segéddel generálsz vagy átírsz, a feladatok itt jelennek meg.",
    errorTitle: "Nem sikerült betölteni az AI feladatokat",
    /**
     * Hungarian relative-time label for a job's created_at, relative to `now`.
     * Short-span aware (jobs are recent): "épp most" → "N perce" → "N órája" →
     * day/week/month/year. Returns "" for an unparseable timestamp.
     */
    relativeCreated: (iso: string, now: Date = new Date()): string => {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return "";
      const diffMs = Math.max(0, now.getTime() - then);
      const minute = 60_000;
      const hour = 3_600_000;
      const day = 86_400_000;
      if (diffMs < minute) return "épp most";
      if (diffMs < hour) return `${Math.floor(diffMs / minute)} perce`;
      if (diffMs < day) return `${Math.floor(diffMs / hour)} órája`;
      const days = Math.floor(diffMs / day);
      if (days === 1) return "tegnap";
      if (days < 7) return `${days} napja`;
      if (days < 30) return `${Math.floor(days / 7)} hete`;
      if (days < 365) return `${Math.floor(days / 30)} hónapja`;
      return `${Math.floor(days / 365)} éve`;
    },
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
    /** Persistent AI-job indicator (running pill + failed-count attention). */
    aiWorking: "AI dolgozik",
    aiWorkingAria: (n: number) =>
      n === 1 ? "1 AI feladat fut" : `${n} AI feladat fut`,
    aiFailed: (n: number) => (n === 1 ? "1 sikertelen" : `${n} sikertelen`),
    aiFailedAria: (n: number) =>
      n === 1 ? "1 sikertelen AI feladat" : `${n} sikertelen AI feladat`,
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
    focusParaAria: "Bekezdés-fókusz",
    focusParaTitle: "Bekezdés-fókusz (a környező szöveg elhalványul)",
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
    beatInputAria: "Jelenet beat leírása",
    beatInputPlaceholder: "Mi történjen ebben a beatben?",
    beatDefaultBeat: "A jelenet következő pillanata.",
    beatError: "A beat generálása sikertelen",
    beatApplyError: "A beat alkalmazása sikertelen",
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
    // AI flow toasts (M5).
    toastRevisionSaved: "Új revízióként mentve",
    toastResultRejected: "Javaslat elvetve",
    toastCopied: "Vágólapra másolva",
    toastSnippetSaved: "Snippetként mentve",
    toastNoSelection: "Jelölj ki szöveget az AI-művelethez",
  },
  /**
   * AI Inspector panel (`Alexandria App.dc.html` right aside, lines ~2466–2890).
   * Tabs, the AI action grid, the Describe accordion, the Beatek / Warnings /
   * Meta tabs. Copy is verbatim from the prototype.
   */
  inspector: {
    /** The five vertical tabs (icon + label). */
    tabAi: "AI",
    tabCodex: "Codex",
    tabBeats: "Beatek",
    tabWarnings: "Figyelm.",
    tabMeta: "Meta",
    tabBarAria: "AI segéd panelek",
    panelAria: "AI segéd",
    // AI tab.
    selectedTextLabel: "Kijelölt szöveg",
    noSelectionHint: "Jelölj ki szöveget a kéziratban egy AI-művelethez.",
    actRewrite: "Átírás",
    actDescribe: "Leírás",
    actExpand: "Bővítés",
    actCompress: "Tömörítés",
    actDialog: "Párbeszéd",
    actFix: "Javítás",
    customInstructionPlaceholder:
      "Egyéni utasítás… (pl. legyen feszültebb a ritmus)",
    customInstructionAria: "Egyéni utasítás",
    generate: "Generálás",
    generating: "Generálás folyamatban…",
    modelSelectorAria: "Modell kiválasztása",
    modelLocalGroup: "Lokális",
    modelCloudGroup: "Felhő",
    modelsLoading: "Modellek betöltése…",
    modelsError: "Nem sikerült betölteni a modelleket",
    disclaimer: "Az AI sosem ír a kéziratba jóváhagyás nélkül.",
    generationError: "A generálás sikertelen",
    /** Result-card label per action (rendered "{label} eredménye"). */
    resultLabel: {
      rewrite: "Átírás",
      describe: "Leírás",
      expand: "Bővítés",
      compress: "Tömörítés",
      dialog: "Párbeszéd",
      fix: "Javítás",
      continue: "Folytatás",
      generate: "Jelenet",
    } as Record<string, string>,
    // Describe sub-panel (6-channel accordion).
    describeTitle: "Érzéki leírás",
    describeBackAria: "Vissza az AI panelre",
    describeFootnote: "Minden javaslat Snippetként menthető — sosem íródik be magától.",
    channelSight: "LÁTÁS",
    channelSound: "HANG",
    channelTouch: "TAPINTÁS",
    channelSmell: "SZAG",
    channelTaste: "ÍZ",
    channelMetaphor: "METAFORA",
    channelGenerating: "Generálás…",
    channelError: "A csatorna generálása sikertelen",
    saveSnippet: "Snippet mentése",
    // Codex tab.
    codexInSceneLabel: "Ebben a jelenetben",
    codexOpenInCodex: "Megnyitás a Codexben →",
    codexEmpty: "Ehhez a jelenethez még nincs Codex-bejegyzés.",
    // Beatek tab.
    beatsLabel: "Jelenet beatek",
    beatsApplied: (words: number) => `alkalmazva · ${words} szó`,
    beatsDraft: "vázlat",
    beatsNew: "Új beat",
    beatsEmpty: "Ehhez a jelenethez még nincs beat.",
    // Warnings tab (B3 — real RAG-backed continuity check).
    warningsLabel: "Folytonosság",
    /** The trigger button + its in-flight label. */
    warningsCheck: "Folytonosság ellenőrzése",
    warningsChecking: "Ellenőrzés folyamatban…",
    /** Re-run label once a result is shown. */
    warningsRecheck: "Újraellenőrzés",
    /** Positive "no issues found" state (warnings: []). */
    warningsNoIssuesTitle: "Nem találtam folytonossági problémát",
    warningsNoIssuesHint:
      "A jelenet összhangban van a Codexszel és önmagával. Szerkesztés után futtasd újra.",
    /** Initial (pre-check) prompt. */
    warningsIdleTitle: "Folytonosság-ellenőrzés",
    warningsIdleHint:
      "Vesd össze a jelenetet a Codexszel: karakter-, időrendi és logikai ellentmondások.",
    /** No active scene to check (e.g. board view). */
    warningsNoScene: "Nyiss meg egy jelenetet a folytonosság ellenőrzéséhez.",
    /** Error state. */
    warningsError: "A folytonosság-ellenőrzés sikertelen",
    /** Result heading: "{n} figyelmeztetés". */
    warningsFound: (n: number) => `${n} figyelmeztetés`,
    /** Severity badge labels (info / warning / error). */
    warningsSeverity: {
      info: "Megjegyzés",
      warning: "Figyelmeztetés",
      error: "Hiba",
    } as Record<string, string>,
    // Meta tab.
    metaLabel: "Jelenet metaadatok",
    metaStatus: "Státusz",
    metaPov: "Nézőpont",
    metaLocation: "Helyszín",
    metaWordCount: "Szószám",
    metaLastSaved: "Utolsó mentés",
    metaUnknown: "—",
  },
  /**
   * Codex screen (`Alexandria App.dc.html` showcodex sidebar ~line 330,
   * Character Detail ~line 941, New-Codex modal ~line 2948). Copy is verbatim
   * from the prototype; the backend Codex is a generic card so aliases + role
   * are folded into the real `tags` list (see lib/api/codex.ts).
   */
  codex: {
    /** Sidebar accessible name + tabs. */
    sidebarAria: "Codex",
    tabCodex: "Codex",
    tabSnippets: "Snippetek",
    tabChats: "Chatek",
    searchPlaceholder: "Keresés…",
    filterAria: "Szűrés",
    addNew: "Új",
    addNewAria: "Új Codex-bejegyzés",
    scopeProject: "Projekt",
    scopeBook: "Ez a könyv",
    scopeSeries: "Sorozat",
    /** Tooltip on the series scope when the active book has no series. */
    scopeSeriesNoSeriesTitle:
      "Ehhez a könyvhöz nincs sorozat társítva — csak a projekt-szintű bejegyzések látszanak.",
    /** Honest note shown in the series scope when the book has no series. */
    seriesNoSeriesNote:
      "Ehhez a könyvhöz nincs sorozat társítva. Csak a projekt-szintű bejegyzések láthatók. Társíts egy sorozatot a kezeléshez.",
    /** Series-scope list states. */
    seriesScopeLoading: "Sorozat-Codex betöltése…",
    /* ---- Series management (Feature #3c) ---- */
    seriesManageAria: "Sorozatok kezelése",
    seriesManageTitle: "Sorozatok",
    seriesManageHint:
      "A sorozatok több könyvön átívelő szereplőket és helyszíneket csoportosítanak egy projekten belül.",
    seriesNewLabel: "Új sorozat",
    seriesNamePlaceholder: "Sorozat neve…",
    seriesCreate: "Létrehozás",
    seriesRename: "Átnevezés",
    seriesRenameAria: (title: string) => `${title} átnevezése`,
    seriesDeleteAria: (title: string) => `${title} törlése`,
    seriesSave: "Mentés",
    seriesCancel: "Mégse",
    seriesEmptyManage: "Még nincs sorozat ebben a projektben.",
    seriesLoadError: "Nem sikerült betölteni a sorozatokat",
    seriesCreateError: "Nem sikerült létrehozni a sorozatot",
    seriesRenameError: "Nem sikerült átnevezni a sorozatot",
    seriesDeleteError: "Nem sikerült törölni a sorozatot",
    seriesCreatedToast: "Sorozat létrehozva",
    seriesRenamedToast: "Sorozat átnevezve",
    seriesDeletedToast: "Sorozat törölve",
    seriesDeleteConfirmTitle: "Sorozat törlése",
    seriesDeleteConfirmDescription: (title: string) =>
      `Biztosan törlöd a(z) „${title}” sorozatot? A bejegyzések projekt-szintűvé válnak.`,
    /* ---- Assign the current book to a series ---- */
    bookSeriesLabel: "A könyv sorozata",
    bookSeriesNone: "Nincs sorozat",
    bookSeriesAssignAria: "A könyv sorozatának kiválasztása",
    bookSeriesSaveError: "Nem sikerült menteni a könyv sorozatát",
    bookSeriesSavedToast: "A könyv sorozata frissítve",
    /* ---- Codex entry scope picker (detail) ---- */
    entryScopeLabel: "Hatókör",
    entryScopeHint:
      "Projekt-szintű: minden könyvben látszik. Sorozat-szintű: csak a sorozat könyveiben.",
    entryScopeProject: "Projekt-szintű (minden könyv)",
    entryScopeSaveError: "Nem sikerült menteni a hatókört",
    // List states.
    listLoading: "Codex betöltése…",
    listError: "Nem sikerült betölteni a Codexet",
    listEmptyTitle: "Még üres a Codex",
    listEmptyHint:
      "Szereplők, helyszínek, tárgyak — az AI ebből merít. Hozd létre az első bejegyzést.",
    listEmptyCta: "Új bejegyzés",
    // Snippetek / Chatek tabs (V1 — honest empty states).
    snippetsEmpty: "A Snippetek nézet a V1-ben érkezik.",
    chatsEmpty: "A Chatek nézet a V1-ben érkezik.",
    // Group headings (by entry type) — "{label} · {count}".
    groupHeading: (label: string, count: number) => `${label} · ${count}`,
    /** Entry-type group labels (plural, sidebar headings). */
    typeGroupLabel: {
      character: "Karakterek",
      location: "Helyszínek",
      object: "Tárgyak",
      organization: "Szervezetek",
      lore: "Lore",
      rule: "Szabályok",
      custom: "Egyéb",
    } as Record<string, string>,
    /** Entry-type singular labels (the detail type pill). */
    typeLabel: {
      character: "Karakter",
      location: "Helyszín",
      object: "Tárgy",
      organization: "Szervezet",
      lore: "Lore",
      rule: "Szabály",
      custom: "Egyéb",
    } as Record<string, string>,
    /** Mention-count suffix on a list row / detail header. */
    mentionCount: (n: number) => `${n} megemlítés`,
    noDescription: "Nincs leírás",
    // Detail header.
    detailScreenLabel: "Codex — Karakter Detail",
    addTag: "+ címke",
    portraitAria: "Portré feltöltése",
    portraitTitle: "Portré feltöltése — húzd ide vagy tallózz",
    portraitLabel: "Portré",
    portraitStubToast: "A portréfeltöltés a V2-ben érkezik",
    pin: "Kitűzés",
    pinStubToast: "Kitűzés a Codex-listára (V1)",
    nameAria: "Bejegyzés neve",
    // Detail tabs.
    tabDetails: "Részletek",
    tabResearch: "Kutatás",
    tabRelations: "Kapcsolatok",
    tabProgress: "Progresszió",
    tabMentions: "Megemlítések",
    tabTracking: "Nyomon követés",
    detailTabsAria: "Bejegyzés nézetek",
    // Részletek tab.
    aliasesLabel: "Álnevek / Becenevek",
    aliasesHint:
      "A felismeréshez használt nevek — a prózában nem lesznek helyesírás-ellenőrizve.",
    aliasesPlaceholder: "vesszővel elválasztva…",
    aliasesSuggestLabel: "Javaslatok:",
    aliasesSuggestAria: "Álnév-javaslat az AI-tól",
    aliasSuggestStubToast: "Az AI álnév-javaslat a V1-ben érkezik",
    aliasRemoveAria: (alias: string) => `${alias} eltávolítása`,
    descriptionLabel: "Leírás",
    descriptionSuggestAria: "Leírás-javaslat az AI-tól",
    descriptionSuggestStubToast: "Az AI leírás-javaslat a V1-ben érkezik",
    descriptionWordCount: (n: number) => `${n} szó`,
    roleLabel: "Szerep a történetben",
    rolePlaceholder: "Pl. Protagonista…",
    addDetail: "Részlet hozzáadása",
    saving: "Mentés…",
    saved: "Mentve",
    saveError: "A mentés sikertelen",
    // Megemlítések tab.
    mentionsLoading: "Jelenetek betöltése…",
    mentionsEmpty:
      "Ez a bejegyzés (név / álnév szerint) még egyetlen jelenetben sem szerepel.",
    mentionsScene: (chapter: string, scene: string) => `${chapter} · ${scene}`,
    // Nyomon követés tab.
    trackingByName: "Nyomkövetés névvel / álnévvel",
    trackingAiContextLabel: "AI kontextus",
    trackingAlways: "Mindig belekerül az AI kontextusba",
    trackingAlwaysHint: "Globális bejegyzésként mindig az AI elé kerül.",
    trackingWhenRecognized: "Beleszámít, ha felismerve",
    trackingDefaultTag: "Alapértelmezett",
    trackingHidden: "Rejtett az AI-tól",
    trackingHiddenHint: "(spoiler-védelem)",
    // Kutatás / Kapcsolatok / Progresszió — honest V1 placeholders.
    researchV1Title: "A Kutatás (AI Q&A) a V1-ben érkezik",
    researchV1Hint:
      "Itt kérdezhetsz majd az AI-tól a bejegyzésről — a válaszok a kéziratból és a Codexből merítenek (RAG).",
    relationsV1Title: "A Kapcsolatok a V1-ben érkezik",
    relationsV1Hint:
      "A szereplők közötti kapcsolatok (szövetséges, mentor, ellenség) itt jelennek majd meg.",
    progressV1Title: "A Progresszió a V1-ben érkezik",
    progressV1Hint:
      "A karakter állapota a történet előrehaladtával — az AI a jelenet idejének megfelelő állapotot húzza be.",
    // Delete.
    deleteAria: "Bejegyzés törlése",
    deleteTitle: "Bejegyzés törlése",
    deleteDescription: (name: string) =>
      `Biztosan törlöd a(z) „${name}" bejegyzést? Ez a művelet nem visszavonható.`,
    deleted: "Bejegyzés törölve",
    deleteError: "A törlés sikertelen",
    // New-Codex modal.
    modalTitle: "Új Codex-bejegyzés",
    modalBackAria: "Vissza",
    modalPickerPrompt: "Válaszd ki a bejegyzés típusát:",
    /** Type-picker grid cards (label + sub-hint). */
    pickerCards: {
      character: { label: "Karakter", hint: "szereplő, POV" },
      location: { label: "Helyszín", hint: "város, épület, táj" },
      object: { label: "Tárgy", hint: "eszköz, ereklye" },
      organization: { label: "Szervezet", hint: "rend, frakció" },
      lore: { label: "Lore", hint: "háttér, mítosz" },
      rule: { label: "Szabály", hint: "mágiarendszer, törvény" },
    } as Record<string, { label: string; hint: string }>,
    modalTypeSuffix: "típusú bejegyzés",
    modalNameLabel: "Név",
    modalNamePlaceholder: "A bejegyzés neve…",
    modalNameRequired: "A név megadása kötelező.",
    modalAliasesLabel: "Álnevek",
    modalDescriptionLabel: "Leírás",
    modalDescriptionPlaceholder: "Rövid leírás — az AI is segíthet kitölteni…",
    modalTrackLabel: "Nyomon követés névvel a kéziratban",
    modalCancel: "Mégse",
    modalCreate: "Bejegyzés létrehozása",
    createdToast: "Új Codex-bejegyzés létrehozva",
    createError: "Nem sikerült létrehozni a bejegyzést",
  },
  /**
   * Plan Board (`Alexandria App.dc.html` showplan ~line 817). Mode pills, view
   * toggle (Rács / Mátrix / Vázlat), density toggle, the SceneCard, act/chapter
   * headers, the bottom action bar. Copy is verbatim from the prototype.
   */
  plan: {
    /** Top mode pills (route to the book's plan / write / chat screens). */
    modeTerv: "Terv",
    modeIras: "Írás",
    modeChat: "Chat",
    /** View toggle (SegmentedControl). */
    viewGrid: "Rács",
    viewMatrix: "Mátrix",
    viewOutline: "Vázlat",
    viewToggleAria: "Nézet",
    /** Density toggle (icon SegmentedControl). */
    densityAria: "Kártya-sűrűség",
    densityDefault: "Normál sűrűség",
    densityCompact: "Kompakt sűrűség",
    densitySlim: "Slim sűrűség",
    /** Search field (filter scenes). */
    searchPlaceholder: "Jelenetek szűrése…",
    searchAria: "Jelenetek szűrése",
    /** Loading / error / empty states. */
    loading: "Terv betöltése…",
    error: "Nem sikerült betölteni a tervet",
    /** Empty-book state — the create→write loop entry point. */
    emptyTitle: "Még üres a könyv",
    emptyHint:
      "Hozd létre az első fejezetet, és kezdődhet a tervezés. A fejezetekbe jelenetek kerülnek — onnan egy kattintással az írásban folytatod.",
    emptyCta: "Első fejezet létrehozása",
    /** Act header (the prototype groups chapters under "I. felvonás"). */
    actLabel: "I. felvonás",
    /** Per-act summary "{n} fejezet" (word count omitted — only real data shown). */
    actChapterCount: (n: number) => `${n} fejezet`,
    /** Act-level "+ Új fejezet" and per-chapter "+ Új jelenet". */
    newChapter: "Új fejezet",
    newScene: "Új jelenet",
    /** Chapter word-count suffix on a column header. */
    chapterWords: (n: string) => `${n} szó`,
    /** SceneCard: "N. jelenet" title fallback + empty summary placeholder. */
    sceneNumber: (n: number) => `${n}. jelenet`,
    summaryPlaceholder: "Összefoglaló hozzáadása…",
    /** SceneCard open-for-writing button. */
    openSceneAria: "Megnyitás írásra",
    sceneMenuAria: "Jelenet műveletek",
    /** Scene kebab menu rows (verbatim). */
    kebabOpen: "Megnyitás írásra",
    kebabPov: "POV váltás",
    kebabDuplicate: "Duplikálás",
    kebabArchive: "Archiválás",
    kebabDelete: "Törlés",
    /** Matrix view footnote. */
    matrixHint:
      "A jelenetek státusz szerint rendezve. Kattints egy cellára a jelenet megnyitásához.",
    matrixChapterColLabel: "Fejezet",
    /** Outline view: "· jelenlegi" marker on the active scene. */
    outlineCurrent: "· jelenlegi",
    /** Bottom action bar. */
    addAct: "Felvonás hozzáadása",
    createFromOutline: "Létrehozás vázlatból",
    importManuscript: "Importálás",
    /** Default titles for newly-created chapters / scenes (the backend requires
     * a non-empty title; the prototype's "+ Új fejezet / + Új jelenet" create
     * unnamed rows, so we seed a sensible Hungarian default). */
    newChapterDefaultTitle: (n: number) => `${n}. fejezet`,
    newSceneDefaultTitle: (n: number) => `${n}. jelenet`,
    /** Delete confirm dialog (reuses ConfirmDialog). */
    deleteTitle: "Jelenet törlése",
    deleteDescription: (name: string) =>
      `Biztosan törlöd a(z) „${name}" jelenetet? Ez a művelet nem visszavonható.`,
    /** Toasts (verbatim from the prototype handlers). */
    toastSceneMoved: "Jelenet áthelyezve",
    toastChapterMoved: "Fejezet áthelyezve",
    toastChapterCreated: "Fejezet létrehozva",
    toastSceneCreated: "Új jelenet hozzáadva a fejezet végéhez",
    toastSceneDeleted: "Jelenet törölve",
    toastSceneArchived: "Jelenet archiválva — az Archívumban visszaállítható",
    toastSceneDuplicated: "Jelenet duplikálva",
    toastPov: "POV váltás — válassz karaktert",
    toastCreateFromOutline: "A Létrehozás vázlatból az M9-ben érkezik",
    toastImport: "A kézirat importálása az M9-ben érkezik",
    toastAddAct: "A felvonások az M9-ben érkeznek — egyelőre egy felvonás",
    /** Mutation error toasts. */
    errorChapterCreate: "Nem sikerült létrehozni a fejezetet",
    errorSceneCreate: "Nem sikerült létrehozni a jelenetet",
    errorSceneDelete: "A törlés sikertelen",
    errorSceneArchive: "Az archiválás sikertelen",
    errorReorder: "Az átrendezés sikertelen",
    /** Drag handle accessible name (the grip on cards/columns). */
    dragHandleAria: "Áthelyezés húzással",
  },
  /**
   * Import / Export screen (`Alexandria App.dc.html` showexport ~line 1449).
   * Markdown export is REAL (wired to POST /books/{id}/exports); DOCX is V1
   * (disabled), EPUB 3 / PDF / TXT are visual stubs; Import is a V1 stub.
   * Copy is verbatim from the prototype.
   */
  exportScreen: {
    /** Screen heading + tabs. */
    title: "Import / Export",
    tabExport: "Exportálás",
    tabImport: "Importálás",
    /** EXPORT tab. */
    intro: "Válassz formátumot és tartományt — a fájlnév ékezet nélkül készül.",
    formatLabel: "Formátum",
    /** Format cards (label + sub-hint, verbatim). */
    fmtMarkdown: "Markdown",
    fmtMarkdownHint: ".md — egyszerű, hordozható",
    fmtDocx: "DOCX",
    fmtDocxHint: ".docx — Word-kompatibilis",
    fmtEpub: "EPUB 3",
    fmtEpubHint: "e-könyv háttérhangokkal",
    fmtEpubBadge: "hang",
    fmtPdf: "PDF",
    fmtPdfHint: "nyomtatásra kész",
    fmtTxt: "TXT",
    fmtTxtHint: ".txt — sima szöveg",
    /** "Hamarosan" badge on the not-yet-real format cards. */
    fmtComingBadge: "hamarosan",
    /** Scope (Tartomány) radios. */
    scopeLabel: "Tartomány",
    scopeBook: (title: string) => `Teljes könyv — ${title}`,
    scopeChapter: "Egy fejezet",
    scopeScene: "Egy jelenet",
    /** Chapter / scene picker (shown for the fejezet / jelenet scope). */
    pickChapterLabel: "Fejezet kiválasztása",
    pickSceneLabel: "Jelenet kiválasztása",
    pickPlaceholder: "Válassz…",
    pickChapterEmpty: "Nincs még fejezet ebben a könyvben.",
    pickSceneEmpty: "Nincs még jelenet ebben a könyvben.",
    pickLoading: "Betöltés…",
    pickError: "Nem sikerült betölteni a fejezeteket/jeleneteket.",
    /** Prefix that groups a chapter's scenes under it in the scene picker. */
    sceneGroupPrefix: (chapterTitle: string) => chapterTitle,
    /** Filename preview row. */
    filenameLabel: "Fájlnév:",
    /** Hanganyagok (audio) accordion — V2 stub. */
    audioLabel: "Hanganyagok",
    audioTitle: "EPUB 3 hanganyagokkal",
    audioHint: "Háttér-atmoszféra és effektek beágyazása a könyvbe",
    audioToggleAria: "Hanganyagok az exportban",
    audioFootnote:
      "3 hang · ~1,8 MB · csak EPUB 3 / Apple Books / Thorium támogatja.",
    audioV2Note: "A hangbeágyazás a V2-ben érkezik.",
    /** Demo audio rows in the accordion (verbatim sample tracks). */
    audioRow1Title: "Éjszakai könyvtár",
    audioRow1Meta: "II. fejezet · atmoszféra",
    audioRow2Title: "Pergamen zizzenése",
    audioRow2Meta: "3. jelenet · effekt",
    /** Export CTA + footnote. */
    exportCta: "Exportálás",
    exporting: "Exportálás…",
    backupNote: "A projekt biztonsági mentése (JSON) a Beállításokban érhető el.",
    /** Toasts. */
    exportSuccess: (filename: string) => `Exportálva: ${filename}`,
    exportError: "Az exportálás sikertelen",
    /** Format-not-real toast (DOCX/EPUB/PDF/TXT). */
    formatStubToast: (format: string) => `A(z) ${format} export a V1-ben érkezik`,
    /** IMPORT tab (V1 stub). */
    importIntroBefore: "Hozz be egy meglévő kéziratot — a tartalom fejezetekre/jelenetekre bomlik és ",
    importIntroStrong: "teljesen szerkeszthető",
    importIntroAfter: " lesz a kéziratban.",
    importDropTitle: "Húzd ide a fájlt, vagy tallózz",
    importDropHint: "DOCX · EPUB 3 · Markdown · PDF · TXT — max. 50 MB",
    importToast: "A kézirat importálása a V1-ben érkezik",
    importFormatsLabel: "Támogatott formátumok",
    importFormats: [
      { badge: "DOC", name: "Word (.docx)", hint: "stílusok → fejezetek" },
      { badge: "EPB", name: "EPUB 3", hint: "fejezetek + média" },
      { badge: "MD", name: "Markdown", hint: "# → fejezet, ## → jelenet" },
      { badge: "PDF", name: "PDF", hint: "szövegréteg kinyerése" },
      { badge: "TXT", name: "Sima szöveg", hint: "üres sor = jelenethatár" },
    ],
    importAiNote:
      "Importálás után megnézheted a fejezet/jelenet felbontást, és az AI fel is ajánlhatja a Codex-bejegyzések automatikus kinyerését a szövegből.",
    /** Loading / error state for the book (title) resolution. */
    bookLoading: "Könyv betöltése…",
    bookError: "Nem sikerült betölteni a könyvet",
  },
  /**
   * Beállítások screen (`Alexandria App.dc.html` showsettings ~line 1556).
   * Hub + Local (Ollama, MVP real-ish) / Cloud (V1) / MCP (V2) subpages +
   * Generálás (Temperature / Max tokens — client-persisted) + Adatkezelés.
   * Copy is verbatim from the prototype.
   */
  settings: {
    /** Hub heading. */
    title: "Beállítások",
    subtitle: "Modell-providerek, MCP-eszközök és generálási paraméterek.",
    /** Providers section. */
    providersLabel: "Providerek",
    localTitle: "Lokális modell-provider",
    localHubSub: (n: number) => `Ollama · ${n} modell elérhető`,
    localBadge: "aktív",
    cloudTitle: "Felhő modell-provider",
    cloudHubSub: "Gemini, Claude, OpenAI, OpenRouter",
    /** Hub Cloud badge — reflects the real configured-provider count. */
    cloudHubBadge: (n: number) =>
      n === 0 ? "nincs kulcs" : `${n} provider`,
    mcpTitle: "MCP provider",
    mcpHubSub: "Model Context Protocol — külső eszközök",
    mcpBadge: "2 szerver",
    providerNavAria: (title: string) => `${title} megnyitása`,
    /** Generálás section (client-persisted params). */
    generationLabel: "Generálás",
    temperatureLabel: "Temperature",
    maxTokensLabel: "Max tokenek",
    temperatureAria: "Temperature",
    maxTokensAria: "Max tokenek",
    modelRouterNote:
      "A modellnevek a ModelRouter konfigurációból érkeznek — a felületen sosem hardcode-oltak.",
    /** Adatkezelés section (V1+ stubs). */
    dataLabel: "Adatkezelés",
    archiveTitle: "Archívum",
    archiveHint:
      "Archivált jelenetek, Codex-bejegyzések, chatek visszaállítása",
    archiveToast: "Az Archívum a V1-ben érkezik",
    backupTitle: "Projekt biztonsági mentése",
    backupHint: "Teljes projekt exportálása JSON-ként",
    backupToast: "A JSON biztonsági mentés a V1-ben érkezik",
    /** Subpage back link. */
    back: "Beállítások",
    backAria: "Vissza a beállításokhoz",
    /** Local subpage (MVP). */
    localSubtitle:
      "Ollama vagy LM Studio a saját gépeden — a kézirat nem hagyja el az eszközt.",
    ollamaName: "Ollama",
    /** Health row — the backend has no health/ping endpoint, so this is an
     * honest stub: we show "elérhetőség ismeretlen" until the user checks. */
    ollamaEndpoint: "http://localhost:11434",
    healthUnknown: "elérhetőség ismeretlen",
    healthCheck: "Ellenőrzés",
    healthToast:
      "A lokális provider állapot-ellenőrzése a V1-ben érkezik (nincs még health-végpont).",
    lmStudioName: "LM Studio",
    lmStudioEndpoint: "http://localhost:1234 · nem elérhető",
    lmStudioReconnect: "Újracsatlakozás",
    lmStudioToast: "Az LM Studio támogatás a V1-ben érkezik",
    installedModelsLabel: "Telepített modellek",
    modelsLoading: "Modellek betöltése…",
    modelsError: "Nem sikerült betölteni a modelleket",
    modelsEmpty: "Nincs telepített modell.",
    /** Recommended tag on the default model. */
    modelRecommended: "ajánlott",
    downloadModel: "Modell letöltése",
    downloadModelToast: "A modell-letöltés a V1-ben érkezik",
    /** Cloud subpage (P1.1 — real provider/API-key configuration). */
    cloudSubtitle:
      "Add meg az API-kulcsokat a felhőszolgáltatókhoz. A kulcsok titkosítva, a szerveren tárolódnak.",
    cloudNote:
      "A teljes API-kulcsot a rendszer sosem jeleníti meg újra — csak a maszkolt előnézetét. Új kulcs megadásához írd be a teljes kulcsot.",
    /** List states. */
    cloudLoading: "Providerek betöltése…",
    cloudError: "Nem sikerült betölteni a providereket.",
    cloudEmpty: "Még nincs felhő-provider beállítva.",
    cloudEmptyHint:
      "Adj hozzá egy API-kulcsot, hogy a felhő-modellek elérhetővé váljanak a generáláshoz.",
    /** Provider type display names. */
    providerTypeNames: {
      ollama: "Ollama (lokális)",
      gemini: "Google Gemini",
      anthropic: "Anthropic Claude",
      openai: "OpenAI",
      openrouter: "OpenRouter",
      custom: "Egyéni (OpenAI-kompatibilis)",
    } as Record<string, string>,
    /** Per-type api-key placeholder hint. */
    providerKeyPlaceholders: {
      gemini: "AIza…",
      anthropic: "sk-ant-…",
      openai: "sk-…",
      openrouter: "sk-or-…",
      custom: "API-kulcs…",
      ollama: "",
    } as Record<string, string>,
    /** Per-provider card. */
    cloudKeyStored: "Kulcs tárolva",
    cloudKeyMissing: "Nincs kulcs megadva",
    cloudNoKeyNeeded: "Nem igényel kulcsot",
    cloudEnabledLabel: "Aktív",
    cloudEnableAria: (label: string) => `${label} be/ki`,
    cloudTestButton: "Kapcsolat tesztelése",
    cloudTesting: "Tesztelés…",
    cloudTestOk: "Kapcsolat rendben",
    cloudTestFail: "Kapcsolat sikertelen",
    cloudTestError: "A teszt nem futott le",
    cloudModelCount: (n: number) => `${n} modell`,
    cloudEditButton: "Szerkesztés",
    cloudEditAria: (label: string) => `${label} szerkesztése`,
    cloudDeleteButton: "Törlés",
    cloudDeleteAria: (label: string) => `${label} törlése`,
    cloudAddProvider: "Provider hozzáadása",
    /** Add/Edit modal. */
    cloudModalAddTitle: "Felhő-provider hozzáadása",
    cloudModalEditTitle: "Provider szerkesztése",
    cloudModalTypeLabel: "Provider típusa",
    cloudModalLabelLabel: "Megnevezés",
    cloudModalLabelPlaceholder: "pl. Gemini (munka)",
    cloudModalKeyLabel: "API-kulcs",
    cloudModalKeyKeepHint: "Hagyd üresen a meglévő kulcs megtartásához.",
    cloudModalKeyNewHint: "A kulcs titkosítva, a szerveren tárolódik.",
    cloudModalBaseUrlLabel: "Alap URL",
    cloudModalBaseUrlPlaceholder: "http://localhost:11434",
    cloudModalDefaultModelLabel: "Alapértelmezett modell",
    cloudModalDefaultModelPlaceholder: "pl. gemini-2.0-flash",
    cloudModalEnabledLabel: "Aktív (használható generáláshoz)",
    cloudModalCancel: "Mégse",
    cloudModalSave: "Mentés",
    cloudModalCreate: "Hozzáadás",
    /** Validation. */
    cloudLabelRequired: "A megnevezés megadása kötelező.",
    cloudKeyRequired: "Felhő-providerhez API-kulcs szükséges.",
    /** Toasts + errors. */
    cloudCreatedToast: "Provider hozzáadva",
    cloudUpdatedToast: "Provider frissítve",
    cloudDeletedToast: "Provider törölve",
    cloudCreateError: "Nem sikerült hozzáadni a providert",
    cloudUpdateError: "Nem sikerült frissíteni a providert",
    cloudDeleteError: "Nem sikerült törölni a providert",
    cloudTestErrorToast: "Nem sikerült tesztelni a kapcsolatot",
    /** Delete confirm. */
    cloudDeleteConfirmTitle: "Provider törlése",
    cloudDeleteConfirmBody: (label: string) =>
      `Biztosan törlöd a(z) „${label}" providert? A tárolt API-kulcs is törlődik.`,
    /** MCP subpage (V2 — visual stub). */
    mcpSubtitle:
      "Model Context Protocol szerverek — külső eszközök és adatforrások, amiket az AI használhat (pl. webkeresés, helyesírás, kutatás-adatbázis).",
    mcpV2Note: "Az MCP-providerek a V2-ben érkeznek.",
    mcpSearchName: "Webkeresés",
    mcpSearchSub: "npx mcp-server-brave · 4 eszköz",
    mcpResearchName: "Kutatás-adatbázis",
    mcpResearchSub: "helyi mappa · 2 eszköz",
    mcpRunning: "fut",
    mcpAddServer: "MCP szerver hozzáadása",
    mcpToggleAria: (name: string) => `${name} be/ki`,
    mcpFootnote:
      "A bekapcsolt MCP-eszközök az AI generálás és a Chat kontextusában válnak elérhetővé.",
  },
  command: {
    placeholder: "Keresés a projektben… jelenetek, Codex, műveletek",
    /** Screen-reader-only description (Radix Dialog requires one). */
    description:
      "Keress jelenetek, Codex-bejegyzések és műveletek között; nyilakkal navigálhatsz, Enterrel választasz.",
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
    /** Command-palette row that opens the keyboard-shortcuts overlay. */
    actionShortcuts: "Billentyűparancsok",
    /** Command-palette row that re-opens the "how it works" onboarding narrative. */
    actionHowItWorks: "Hogyan működik",
  },
  /**
   * First-run "Hogyan működik" (how it works) scroll-narrative. Teaches the core
   * loop in four calm panels. Shown once (localStorage-gated), always skippable,
   * and re-openable from the command palette. Under reduced motion the panels
   * render as a plain static stack — the copy below is the a11y baseline.
   */
  howItWorks: {
    /** Dialog accessible name + heading. */
    title: "Hogyan működik az Alexandria",
    /** Screen-reader-only dialog description (Radix Dialog requires one). */
    description:
      "Négy lépésben bemutatjuk az Alexandria alapfolyamatát: Codex, tervezés, AI-javaslat és jóváhagyás. Görgetéssel haladhatsz, vagy bármikor kihagyhatod.",
    /** Eyebrow above the title. */
    eyebrow: "Üdvözlünk",
    /** Skip / dismiss-forever button (writes the localStorage flag). */
    skip: "Kihagyás",
    /** Aria for the skip button. */
    skipAria: "Bevezető kihagyása és bezárása",
    /** Close button (writes the flag too — both routes dismiss permanently). */
    close: "Bezárás",
    /** Aria for the close button. */
    closeAria: "Bezárás",
    /** Hint that scrolling advances the panels (hidden under reduced motion). */
    scrollHint: "Görgess a folytatáshoz",
    /** Step counter prefix, e.g. "1 / 4". */
    panels: [
      {
        kicker: "1. lépés",
        title: "Codex",
        body: "A világod — karakterek, helyszínek, lore — egy kereshető tudásbázis, ami táplálja az AI-t.",
      },
      {
        kicker: "2. lépés",
        title: "Tervezés",
        body: "Fejezetek, jelenetek és beat-ek: a Plan Boardon rendezed el a történetet.",
      },
      {
        kicker: "3. lépés",
        title: "AI-javaslat",
        body: "Az AI a Codex-kontextusból átír, folytat vagy jelenetet generál — sosem közvetlenül a kéziratba.",
      },
      {
        kicker: "4. lépés",
        title: "Jóváhagyás",
        body: "Minden AI-szöveg Revízióként érkezik; te döntesz: Elfogad vagy Elvet. A te hangod marad.",
      },
    ],
  },
  /**
   * Keyboard-shortcuts help overlay (opened with `?` or from the command
   * palette). Shortcuts are grouped by area; key labels are platform-aware
   * (⌘ on Mac, Ctrl on Windows/Linux) at render time.
   */
  shortcuts: {
    /** Dialog title + trigger affordance. */
    title: "Billentyűparancsok",
    triggerAria: "Billentyűparancsok megnyitása",
    /** Screen-reader-only dialog description (Radix Dialog requires one). */
    description:
      "A billentyűparancsok listája területenként csoportosítva. Esc bezár.",
    /** Group headings. */
    groupGeneral: "Általános",
    groupEditor: "Szerkesztő",
    groupAi: "AI",
    /** Action descriptions. */
    commandPalette: "Parancspaletta",
    showShortcuts: "Billentyűparancsok",
    closeExitFocus: "Bezárás / kilépés a fókusz módból",
    slashMenu: "Parancsmenü a szerkesztőben",
    bold: "Félkövér",
    italic: "Dőlt",
    aiRewrite: "Kijelölés átírása",
    aiContinue: "Folytatás írása",
  },
  toast: {
    comingSoon: "Hamarosan",
  },
  /**
   * Error-boundary microcopy. Covers the last-resort root boundary
   * (`app/global-error.tsx`), the in-shell route-segment boundary
   * (`app/(app)/error.tsx`) and the compact per-pane boundary
   * (`components/kit/error-boundary.tsx`). The boundaries always render a
   * visible, recoverable fallback — never a white screen, never a silent swallow.
   */
  errors: {
    /** Last-resort root boundary (renders its own <html><body>). */
    rootTitle: "Váratlan hiba történt",
    rootHint:
      "Az alkalmazás váratlan hibába ütközött. Próbáld újra — ha a hiba ismétlődik, töltsd újra az oldalt.",
    rootRetry: "Próbáld újra",
    /** In-shell route-segment boundary. */
    routeTitle: "Ez a nézet hibába ütközött",
    routeHint:
      "A nézet betöltése közben hiba történt. Töltsd újra — a munkaterületed megmarad.",
    routeRetry: "Újratöltés",
    /** Compact per-pane boundary (editor / inspector / plan board). */
    paneTitle: "Ez a panel hibába ütközött",
    paneRetry: "Újratöltés",
    /** Screen-reader-only label distinguishing a recoverable error region. */
    regionAria: "Hiba",
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
    chatLabel: "Chat",
    chatHint: "A Chat az M10-ben érkezik.",
    cselekmenyszalakLabel: "Cselekményszálak",
    cselekmenyszalakHint: "A Cselekményszálak az M10-ben érkezik.",
    hangokLabel: "Hangkönyvtár",
    hangokHint: "A Hangkönyvtár az M11-ben (V2) érkezik.",
    idosorLabel: "Idősor",
    idosorHint: "Az Idősor az M10-ben érkezik.",
    kapcsolatokLabel: "Kapcsolatok",
    kapcsolatokHint: "A Kapcsolatok az M10-ben érkezik.",
    promptokLabel: "Prompt Library",
    promptokHint: "A Prompt Library az M10-ben érkezik.",
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
     * Card meta line combining the project's book count and total word count
     * (Feature #1). Both values come from the backend aggregates. The word count
     * uses hu-locale grouping (space thousands separator). 0 books renders as
     * "Nincs könyv"; counts are joined with a middle dot.
     */
    metaCounts: (books: number, words: number): string => {
      const bookPart = books === 0 ? "Nincs könyv" : `${books} könyv`;
      const wordPart = `${words.toLocaleString("hu-HU")} szó`;
      return `${bookPart} · ${wordPart}`;
    },
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
  /** DOCX import dialog (Feature #2b). */
  importDialog: {
    title: "Kézirat importálása",
    description:
      "Tölts fel egy .docx fájlt — az Alexandria fejezetekre és jelenetekre bontja, és új könyvet hoz létre belőle.",
    fileLabel: "Word dokumentum (.docx)",
    filePickerCta: "Fájl kiválasztása",
    titleLabel: "Könyv címe (opcionális)",
    titlePlaceholder: "Ha üres, a fájlnévből vagy a dokumentum első sorából derül ki",
    submit: "Importálás",
    cancel: "Mégse",
    importing: "Importálás folyamatban…",
    /** Success toast: how many chapters/scenes were created. */
    successToast: (chapters: number, scenes: number): string =>
      `Kész: ${chapters} fejezet, ${scenes} jelenet importálva.`,
    errorTitle: "Az importálás sikertelen",
    /** Shown when the user submits without choosing a file. */
    noFileError: "Válassz ki egy .docx fájlt az importáláshoz.",
    /** Shown when a non-.docx file is chosen client-side. */
    wrongTypeError: "Csak .docx fájlt lehet importálni.",
  },
  /** Project JSON backup / restore (Feature #5). */
  backup: {
    /** Project-card menu / action labels. */
    exportAction: "Exportálás (JSON)",
    restoreAction: "Visszaállítás (JSON)",
    /** aria-label for the per-card actions menu trigger. */
    menuAria: "Projekt műveletek",
    /** Toast while the backup is being prepared/downloaded. */
    exporting: "Biztonsági mentés készítése…",
    exportSuccess: "A biztonsági mentés letöltődött.",
    exportError: "A biztonsági mentés sikertelen",
    /** Restore dialog. */
    restoreTitle: "Projekt visszaállítása",
    restoreDescription:
      "Tölts fel egy korábban exportált .json mentést — az Alexandria új projektként állítja vissza a teljes tartalmat (a meglévő projektek érintetlenek maradnak).",
    fileLabel: "Mentésfájl (.json)",
    submit: "Visszaállítás",
    cancel: "Mégse",
    restoring: "Visszaállítás folyamatban…",
    /** Success toast: the restored project's title. */
    restoreSuccess: (title: string): string =>
      `Visszaállítva: „${title}”.`,
    restoreError: "A visszaállítás sikertelen",
    /** Shown when the user submits without choosing a file. */
    noFileError: "Válassz ki egy .json mentésfájlt a visszaállításhoz.",
    /** Shown when a non-.json file is chosen client-side. */
    wrongTypeError: "Csak .json mentésfájlt lehet visszaállítani.",
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
