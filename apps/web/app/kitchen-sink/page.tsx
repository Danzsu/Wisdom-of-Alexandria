"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  Copy,
  Grid2x2,
  Image as ImageIcon,
  List,
  MapPin,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  User,
  Wand2,
} from "lucide-react";
import {
  AIResultCard,
  Avatar,
  Badge,
  BarChart,
  BookSpineCard,
  BrandStar,
  Button,
  Card,
  CheckboxRow,
  ConfirmDialog,
  ContextChips,
  DashedTile,
  DiffPane,
  FieldLabel,
  FilterChip,
  FormInput,
  Icon,
  IconButton,
  MenuRow,
  MenuSection,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  ModalTrigger,
  ModelSelector,
  type ModelGroup,
  PasswordInput,
  PillButton,
  PopoverMenu,
  PopoverMenuContent,
  PopoverMenuTrigger,
  ProgressBar,
  QuoteBlock,
  RangeSlider,
  SectionEyebrow,
  SegmentedControl,
  SelectableCheckboxCard,
  Skeleton,
  Sparkline,
  Spinner,
  SplitButtonDropdown,
  StatusDot,
  Tab,
  TabBar,
  Textarea,
  ThemeToggle,
  TimelineNode,
  TimelineSpine,
  Toaster,
  ToggleSwitch,
  Tooltip,
  TooltipProvider,
  TypedRadioGroup,
  VariableTokenChip,
  type DiffSegment,
  toast,
} from "@/components/kit";

/** A labelled gallery section. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="font-serif text-xl font-semibold text-text">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

/** A small captioned wrapper for one specimen. */
function Specimen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[11px] text-text-faint">{label}</span>
      {children}
    </div>
  );
}

/** Placeholder model list for the ModelSelector specimen (data, not hardcoded in the component). */
const DEMO_MODELS: ModelGroup[] = [
  {
    label: "Lokális",
    models: [
      { id: "ollama/llama3.2", label: "ollama/llama3.2 — lokális", kind: "local" },
      {
        id: "ollama/mistral-nemo",
        label: "ollama/mistral-nemo — lokális",
        kind: "local",
      },
    ],
  },
  {
    label: "Felhő",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", kind: "cloud" },
      {
        id: "claude-4.5-sonnet",
        label: "Claude 4.5 Sonnet",
        kind: "cloud",
        moderated: true,
      },
    ],
  },
];

/** Demo diff segments for the DiffPane specimen. */
const DIFF_ORIGINAL: DiffSegment[] = [
  { type: "equal", text: "A könyvtár éjszaka " },
  { type: "deletion", text: "fura" },
  { type: "equal", text: " volt: a polcok árnyai " },
  { type: "deletion", text: "hosszúak lettek" },
  { type: "equal", text: "." },
];
const DIFF_SUGGESTION: DiffSegment[] = [
  { type: "equal", text: "A könyvtár éjszaka " },
  { type: "addition", text: "másképp lélegzett" },
  { type: "equal", text: ": a polcok árnyai " },
  {
    type: "addition",
    text: "hosszúra nyúltak, mintha a betűk is aludni készülnének",
  },
  { type: "equal", text: "." },
];

export default function KitchenSinkPage() {
  const [seg, setSeg] = useState("grid");
  const [view, setView] = useState("rács");
  const [tab, setTab] = useState("reszletek");
  const [pillActive, setPillActive] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("scene");
  const [temperature, setTemperature] = useState(0.8);
  const [model, setModel] = useState("ollama/llama3.2");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  return (
    <TooltipProvider>
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandStar size={26} title="Alexandria" />
          <span className="font-serif text-[22px] font-semibold text-text">
            Kitchen Sink — Kit M1a + M1b
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* 1. BrandStar */}
      <Section title="BrandStar">
        <Specimen label="brand 19">
          <BrandStar size={19} title="brand" />
        </Specimen>
        <Specimen label="brand 26">
          <BrandStar size={26} title="brand-lg" />
        </Specimen>
        <Specimen label="sparkle (AI)">
          <BrandStar size={20} variant="sparkle" title="AI sparkle" />
        </Specimen>
        <Specimen label="decorative">
          <BrandStar size={16} />
        </Specimen>
      </Section>

      {/* 2. Icon */}
      <Section title="Icon">
        <Specimen label="11">
          <Icon icon={Search} size={11} aria-label="keresés" />
        </Specimen>
        <Specimen label="16 (default)">
          <Icon icon={Search} aria-label="keresés" />
        </Specimen>
        <Specimen label="19">
          <Icon icon={Wand2} size={19} aria-label="varázspálca" />
        </Specimen>
        <Specimen label="accent colour">
          <span className="text-accent">
            <Icon icon={Sparkles} size={18} aria-label="csillám" />
          </span>
        </Specimen>
      </Section>

      {/* 3. IconButton */}
      <Section title="IconButton">
        {([24, 26, 28, 30, 32, 38] as const).map((s) => (
          <Specimen key={s} label={`size ${s}`}>
            <IconButton size={s} aria-label={`méret ${s}`}>
              <Icon icon={Plus} size={s <= 26 ? 14 : 16} />
            </IconButton>
          </Specimen>
        ))}
        <Specimen label="ai">
          <IconButton variant="ai" aria-label="AI">
            <Icon icon={Wand2} />
          </IconButton>
        </Specimen>
        <Specimen label="danger">
          <IconButton variant="danger" aria-label="törlés">
            <Icon icon={Trash2} />
          </IconButton>
        </Specimen>
      </Section>

      {/* 4. Button */}
      <Section title="Button">
        <Specimen label="cta + sweep">
          <Button variant="cta" sweep leadingIcon={<Icon icon={Plus} />}>
            Új könyv
          </Button>
        </Specimen>
        <Specimen label="secondary">
          <Button variant="secondary">Mégse</Button>
        </Specimen>
        <Specimen label="ghost">
          <Button variant="ghost">Ghost</Button>
        </Specimen>
        <Specimen label="success">
          <Button variant="success" leadingIcon={<Icon icon={CheckCircle2} />}>
            Elfogad
          </Button>
        </Specimen>
        <Specimen label="destructive">
          <Button variant="destructive">Törlés</Button>
        </Specimen>
        <Specimen label="accent-outline">
          <Button variant="accent-outline">Átírás</Button>
        </Specimen>
        <Specimen label="dashed">
          <Button variant="dashed" leadingIcon={<Icon icon={Plus} />}>
            Hozzáad
          </Button>
        </Specimen>
        <Specimen label="pill">
          <Button variant="cta" shape="pill">
            Pill
          </Button>
        </Specimen>
        <Specimen label="sizes 28/30/32/34/40">
          <div className="flex items-center gap-2">
            {([28, 30, 32, 34, 40] as const).map((s) => (
              <Button key={s} variant="secondary" size={s}>
                {s}
              </Button>
            ))}
          </div>
        </Specimen>
      </Section>

      {/* 5. PillButton / FilterChip */}
      <Section title="PillButton / FilterChip">
        <Specimen label="chevron">
          <PillButton chevron leadingIcon={<Icon icon={User} size={13} />}>
            Karakter
          </PillButton>
        </Specimen>
        <Specimen label="dot + count">
          <PillButton dot="warning" count={3}>
            Figyelmeztetés
          </PillButton>
        </Specimen>
        <Specimen label="active toggle">
          <FilterChip
            active={pillActive}
            onClick={() => setPillActive((v) => !v)}
          >
            {pillActive ? "Aktív" : "Inaktív"}
          </FilterChip>
        </Specimen>
        <Specimen label="size 30">
          <PillButton size={30}>Kompakt</PillButton>
        </Specimen>
      </Section>

      {/* 6. SegmentedControl */}
      <Section title="SegmentedControl">
        <Specimen label="text">
          <SegmentedControl
            aria-label="nézet"
            value={seg}
            onValueChange={setSeg}
            options={[
              { value: "grid", label: "Rács" },
              { value: "matrix", label: "Mátrix" },
              { value: "outline", label: "Vázlat" },
            ]}
          />
        </Specimen>
        <Specimen label="icon">
          <SegmentedControl
            aria-label="elrendezés"
            variant="icon"
            value={view}
            onValueChange={setView}
            options={[
              { value: "rács", label: "Rács", icon: <Icon icon={Grid2x2} /> },
              { value: "lista", label: "Lista", icon: <Icon icon={List} /> },
              { value: "tábla", label: "Tábla", icon: <Icon icon={Table2} /> },
            ]}
          />
        </Specimen>
      </Section>

      {/* 7. Tab + TabBar */}
      <Section title="Tab + TabBar">
        <div className="w-full max-w-md">
          <TabBar aria-label="részletek">
            {[
              { id: "reszletek", label: "Részletek" },
              { id: "megemlitesek", label: "Megemlítések" },
              { id: "nyomon", label: "Nyomon követés" },
            ].map((t) => (
              <Tab
                key={t.id}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Tab>
            ))}
          </TabBar>
        </div>
        <Specimen label="vertical (inspector)">
          <div className="flex w-48 gap-2 rounded-lg border border-border p-1">
            <Tab orientation="vertical" active icon={<Icon icon={Wand2} />}>
              AI
            </Tab>
            <Tab orientation="vertical" icon={<Icon icon={BookOpen} />}>
              Codex
            </Tab>
            <Tab orientation="vertical" icon={<Icon icon={User} />}>
              Jegyzet
            </Tab>
          </div>
        </Specimen>
      </Section>

      {/* 8. SectionEyebrow */}
      <Section title="SectionEyebrow">
        <Specimen label="muted">
          <SectionEyebrow>Karakterek</SectionEyebrow>
        </Specimen>
        <Specimen label="faint">
          <SectionEyebrow tone="faint">Popover fejléc</SectionEyebrow>
        </Specimen>
        <Specimen label="accent / h3">
          <SectionEyebrow as="h3" tone="accent">
            Kiemelt
          </SectionEyebrow>
        </Specimen>
      </Section>

      {/* 9. Badge / StatusPill */}
      <Section title="Badge / StatusPill">
        <Specimen label="neutral">
          <Badge>Piszkozat</Badge>
        </Specimen>
        <Specimen label="accent">
          <Badge variant="accent">Aktív</Badge>
        </Specimen>
        <Specimen label="ai + icon">
          <Badge variant="ai" icon={<Icon icon={Sparkles} size={11} />}>
            AI
          </Badge>
        </Specimen>
        <Specimen label="success">
          <Badge variant="success" icon={<Icon icon={CheckCircle2} size={11} />}>
            Kész
          </Badge>
        </Specimen>
        <Specimen label="warning + AlertTriangle">
          <Badge
            variant="warning"
            icon={<Icon icon={AlertTriangle} size={11} />}
          >
            Ellenőrizd
          </Badge>
        </Specimen>
        <Specimen label="danger">
          <Badge variant="danger">Hiba</Badge>
        </Specimen>
        <Specimen label="severity">
          <Badge
            variant="severity"
            icon={<Icon icon={AlertTriangle} size={11} />}
          >
            Kritikus
          </Badge>
        </Specimen>
        <Specimen label="pov1..6">
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5, 6] as const).map((n) => (
              <Badge key={n} variant={`pov${n}` as `pov${typeof n}`}>
                POV{n}
              </Badge>
            ))}
          </div>
        </Specimen>
        <Specimen label="sizes 16/18/20/24">
          <div className="flex items-center gap-1.5">
            {([16, 18, 20, 24] as const).map((s) => (
              <Badge key={s} variant="accent" size={s}>
                {s}
              </Badge>
            ))}
          </div>
        </Specimen>
      </Section>

      {/* 10. StatusDot */}
      <Section title="StatusDot">
        {(["success", "danger", "neutral", "accent", "warning", "ai"] as const).map(
          (v) => (
            <Specimen key={v} label={v}>
              <StatusDot variant={v} size={8} />
            </Specimen>
          ),
        )}
        <Specimen label="sizes 6/7/8/16">
          <div className="flex items-center gap-2">
            {([6, 7, 8, 16] as const).map((s) => (
              <StatusDot key={s} variant="accent" size={s} />
            ))}
          </div>
        </Specimen>
        <Specimen label="timeline">
          <StatusDot treatment="timeline" />
        </Specimen>
        <Specimen label="planned">
          <StatusDot treatment="planned" />
        </Specimen>
        <Specimen label="presence">
          <StatusDot treatment="presence" variant="success" />
        </Specimen>
      </Section>

      {/* 11. Avatar */}
      <Section title="Avatar">
        <Specimen label="sizes 21..60">
          <div className="flex items-center gap-2">
            {([21, 24, 28, 30, 34, 38, 56, 60] as const).map((s) => (
              <Avatar key={s} name="Kovács Anna" size={s} />
            ))}
          </div>
        </Specimen>
        <Specimen label="deterministic pov by name">
          <div className="flex items-center gap-2">
            {["Anna", "Béla", "Cecília", "Dávid", "Emil", "Fanni"].map((n) => (
              <Avatar key={n} name={n} size={34} />
            ))}
          </div>
        </Specimen>
        <Specimen label="explicit accent / ai">
          <div className="flex items-center gap-2">
            <Avatar initials="AI" color="ai" size={34} />
            <Avatar initials="AC" color="accent" size={34} />
          </div>
        </Specimen>
        <Specimen label="stack">
          <div className="flex pl-[7px]">
            {["Anna", "Béla", "Cecília"].map((n) => (
              <Avatar key={n} name={n} size={24} variant="stack" />
            ))}
          </div>
        </Specimen>
        <Specimen label="graph">
          <Avatar name="Gráf csomópont" size={56} variant="graph" />
        </Specimen>
        <Specimen label="presence">
          <Avatar name="Online" size={38} presence="success" />
        </Specimen>
      </Section>

      {/* 12. Card */}
      <Section title="Card">
        <Card className="w-56">
          <p className="text-sm text-text-soft">Alap kártya tartalommal.</p>
        </Card>
        <Card interactive className="w-56">
          <p className="text-sm text-text-soft">Interaktív (hover-lift).</p>
        </Card>
        <Card selected className="w-56">
          <p className="text-sm text-text-soft">Kijelölt állapot.</p>
        </Card>
        <Card accentEdge="ai" className="w-56">
          <p className="text-sm text-text-soft">AI bal-szegély.</p>
        </Card>
        <Card accentEdge="danger" className="w-56">
          <p className="text-sm text-text-soft">Danger bal-szegély.</p>
        </Card>
        <Card
          coverTop={<Icon icon={BookOpen} size={20} />}
          className="w-44"
        >
          <p className="text-sm font-semibold text-text">Cover-top kártya</p>
          <p className="text-xs text-text-muted">Arany fejléc.</p>
        </Card>
        <Card
          coverTop={<Icon icon={BookOpen} size={20} />}
          coverVariant="blueGrey"
          className="w-44"
        >
          <p className="text-sm font-semibold text-text">Kék-szürke fejléc</p>
        </Card>
      </Section>

      {/* 13. QuoteBlock */}
      <Section title="QuoteBlock">
        <QuoteBlock className="max-w-md">
          A könyvtár nem csupán könyvek gyűjteménye, hanem a megőrzött idő maga.
        </QuoteBlock>
      </Section>

      {/* 14. ProgressBar */}
      <Section title="ProgressBar">
        <Specimen label="determinate 30%">
          <div className="w-64">
            <ProgressBar value={30} />
          </div>
        </Specimen>
        <Specimen label="determinate + label">
          <div className="w-64">
            <ProgressBar value={64} showLabel />
          </div>
        </Specimen>
        <Specimen label="indeterminate">
          <div className="w-64">
            <ProgressBar indeterminate />
          </div>
        </Specimen>
      </Section>

      {/* 15. Spinner */}
      <Section title="Spinner">
        <Specimen label="ai">
          <Spinner variant="ai" />
        </Specimen>
        <Specimen label="accent">
          <Spinner variant="accent" size={14} />
        </Specimen>
      </Section>

      {/* 16. Skeleton */}
      <Section title="Skeleton">
        <div className="flex w-72 flex-col gap-2">
          <Skeleton height={14} />
          <Skeleton height={9} width="80%" />
          <Skeleton height={9} width="60%" />
        </div>
      </Section>

      {/* 17. VariableTokenChip */}
      <Section title="VariableTokenChip">
        <Specimen label="required">
          <VariableTokenChip>{"{{beat}}"}</VariableTokenChip>
        </Specimen>
        <Specimen label="optional">
          <VariableTokenChip variant="optional">{"{{tone}}"}</VariableTokenChip>
        </Specimen>
        <Specimen label="inline">
          <p className="text-sm text-text-soft">
            Írd meg a{" "}
            <VariableTokenChip inline>{"{{scene}}"}</VariableTokenChip> jelenetet.
          </p>
        </Specimen>
      </Section>

      {/* 18. BookSpineCard / CoverThumbnail */}
      <Section title="BookSpineCard / CoverThumbnail">
        <Specimen label="sm gold">
          <BookSpineCard size="sm" title="Kötet" />
        </Specimen>
        <Specimen label="grid gold">
          <BookSpineCard size="grid" title="Kötet" />
        </Specimen>
        <Specimen label="wizard blue-grey">
          <BookSpineCard size="wizard" variant="blueGrey" title="Kötet" />
        </Specimen>
        <Specimen label="star glyph">
          <BookSpineCard size="grid" glyph="star" title="Kedvenc" />
        </Specimen>
      </Section>

      {/* 19. ContextChips */}
      <Section title="ContextChips">
        <ContextChips
          entities={[
            { label: "Anna", icon: <Icon icon={User} size={11} /> },
            { label: "Alexandria", icon: <Icon icon={MapPin} size={11} /> },
          ]}
          model="ollama / llama3"
        />
      </Section>

      {/* 20. BarChart + Sparkline */}
      <Section title="BarChart + Sparkline">
        <Specimen label="BarChart">
          <div className="w-80">
            <BarChart
              aria-label="heti szavak"
              data={[
                { label: "H", value: 36 },
                { label: "K", value: 54 },
                { label: "Sze", value: 64 },
                { label: "Cs", value: 40 },
                { label: "P", value: 8, planned: true },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="Sparkline">
          <div className="w-60">
            <Sparkline
              aria-label="trend"
              data={[86, 64, 72, 40, 52, 22, 34]}
            />
          </div>
        </Specimen>
      </Section>

      {/* 21. Timeline */}
      <Section title="TimelineNode / Marker / Spine">
        <div className="relative w-80 pl-8">
          <TimelineSpine className="left-[8px]" />
          <TimelineNode state="completed">
            <Card>
              <p className="text-sm font-semibold text-text">1. fejezet</p>
              <p className="text-xs text-text-muted">Kész</p>
            </Card>
          </TimelineNode>
          <TimelineNode state="current">
            <Card selected>
              <p className="text-sm font-semibold text-text">2. fejezet</p>
              <p className="text-xs text-text-muted">Folyamatban</p>
            </Card>
          </TimelineNode>
          <TimelineNode state="planned">
            <Card>
              <p className="text-sm font-semibold text-text">3. fejezet</p>
              <p className="text-xs text-text-muted">Tervezett</p>
            </Card>
          </TimelineNode>
        </div>
      </Section>

      {/* ===================== M1b: Radix + composite ===================== */}
      <h2 className="mt-4 font-serif text-2xl font-bold text-accent-text">
        Milestone 1b — Radix + composite
      </h2>

      {/* 22. FormInput / Textarea / PasswordInput */}
      <Section title="FormInput / Textarea / Password">
        <div className="flex w-72 flex-col gap-3">
          <div>
            <FieldLabel htmlFor="ks-name">Név</FieldLabel>
            <FormInput id="ks-name" placeholder="A bejegyzés neve…" />
          </div>
          <div>
            <FieldLabel htmlFor="ks-err">Hibás mező</FieldLabel>
            <FormInput id="ks-err" defaultValue="x" error="Kötelező mező" />
          </div>
          <div>
            <FieldLabel
              htmlFor="ks-pw"
              hint={<BrandStar size={12} variant="sparkle" />}
            >
              Jelszó
            </FieldLabel>
            <PasswordInput id="ks-pw" placeholder="sk-ant-…" />
          </div>
        </div>
        <div className="flex w-72 flex-col gap-3">
          <Textarea placeholder="Egyéni utasítás…" minHeight={60} />
          <Textarea
            variant="manuscript"
            placeholder="Kézirat-stílusú leírás…"
            minHeight={60}
          />
          <Textarea variant="mono" placeholder="# Vázlat" minHeight={60} />
        </div>
      </Section>

      {/* 23. ToggleSwitch */}
      <Section title="ToggleSwitch">
        <Specimen label="md (controlled)">
          <ToggleSwitch
            label="Automatikus mentés"
            checked={switchOn}
            onCheckedChange={setSwitchOn}
          />
        </Specimen>
        <Specimen label="sm">
          <ToggleSwitch size="sm" aria-label="kicsi kapcsoló" defaultChecked />
        </Specimen>
        <Specimen label="off">
          <ToggleSwitch aria-label="kikapcsolt" />
        </Specimen>
      </Section>

      {/* 24. Checkbox / SelectableCheckboxCard */}
      <Section title="CheckboxRow / SelectableCheckboxCard">
        <div className="flex w-64 flex-col gap-2">
          <CheckboxRow
            label="Jelenet kontextus"
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
          />
          <CheckboxRow label="Teljes regény" subText="lassabb, drágább" />
          <CheckboxRow label="Codex" defaultChecked />
        </div>
        <div className="flex w-72 flex-col gap-2">
          <SelectableCheckboxCard
            title="Damianosz"
            subTitle="Karakter · 3 említés"
            defaultChecked
            leading={<Avatar name="Damianosz" size={28} />}
          />
          <SelectableCheckboxCard
            title="A rejtett jelek"
            subTitle="Lore · 2 említés"
            leading={
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                <Icon icon={BookOpen} size={14} />
              </span>
            }
          />
        </div>
      </Section>

      {/* 25. RadioGroup */}
      <Section title="RadioGroup">
        <div className="w-64">
          <TypedRadioGroup
            aria-label="hatókör"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: "scene", label: "Jelenet kontextus" },
              {
                value: "book",
                label: "Teljes regény",
                subText: "minden fejezet",
              },
              { value: "codex", label: "Csak Codex" },
            ]}
          />
        </div>
      </Section>

      {/* 26. RangeSlider */}
      <Section title="RangeSlider">
        <Specimen label="Temperature + value">
          <div className="w-72">
            <RangeSlider
              aria-label="Temperature"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onValueChange={setTemperature}
              showValue
              formatValue={(v) => v.toFixed(1)}
            />
          </div>
        </Specimen>
      </Section>

      {/* 27. PopoverMenu + MenuRow */}
      <Section title="PopoverMenu / MenuRow">
        <PopoverMenu>
          <PopoverMenuTrigger asChild>
            <Button variant="secondary" size={32}>
              Jelenet műveletek
            </Button>
          </PopoverMenuTrigger>
          <PopoverMenuContent align="start">
            <MenuSection label="Jelenet" />
            <MenuRow
              leadingIcon={<Icon icon={PenLine} size={14} />}
              onSelect={() => toast("Megnyitás írásra")}
            >
              Megnyitás írásra
            </MenuRow>
            <MenuRow
              leadingIcon={<Icon icon={Copy} size={14} />}
              onSelect={() => toast("Duplikálva")}
            >
              Duplikálás
            </MenuRow>
            <MenuRow
              leadingIcon={<Icon icon={Archive} size={14} />}
              onSelect={() => toast("Archiválva")}
            >
              Archiválás
            </MenuRow>
            <MenuRow
              variant="danger"
              leadingIcon={<Icon icon={Trash2} size={14} />}
              onSelect={() => setConfirmOpen(true)}
            >
              Törlés
            </MenuRow>
          </PopoverMenuContent>
        </PopoverMenu>
      </Section>

      {/* 28. SplitButtonDropdown */}
      <Section title="SplitButtonDropdown">
        <SplitButtonDropdown
          label="Írás"
          leadingIcon={<Icon icon={PenLine} size={14} />}
          onSelect={(id) => toast(`Választott: ${id}`)}
          items={[
            {
              id: "continue",
              label: "Folytatás",
              subtitle: "innen tovább ír",
              section: "Generálás",
              icon: <Icon icon={Wand2} size={14} />,
            },
            {
              id: "scene",
              label: "Jelenet beatekből",
              subtitle: "beat-lista → próza",
              section: "Generálás",
              icon: <Icon icon={Sparkles} size={14} />,
            },
            {
              id: "archive",
              label: "Archiválás",
              section: "Több",
              icon: <Icon icon={Archive} size={14} />,
            },
          ]}
        />
      </Section>

      {/* 29. ModelSelector */}
      <Section title="ModelSelector">
        <div className="w-72">
          <ModelSelector
            groups={DEMO_MODELS}
            value={model}
            onChange={(id) => {
              setModel(id);
              toast.success("Modell kiválasztva");
            }}
          />
        </div>
      </Section>

      {/* 30. ModalShell */}
      <Section title="ModalShell">
        <Modal open={modalOpen} onOpenChange={setModalOpen}>
          <ModalTrigger asChild>
            <Button variant="cta" size={34}>
              Modal megnyitása
            </Button>
          </ModalTrigger>
          <ModalShell maxWidth={520}>
            <ModalHeader
              title="Új Codex-bejegyzés"
              leadingIcon={<BrandStar size={17} variant="sparkle" />}
            />
            <ModalBody>
              <FieldLabel htmlFor="ks-modal-name">Név</FieldLabel>
              <FormInput id="ks-modal-name" placeholder="A bejegyzés neve…" />
              <p className="mt-3 text-sm text-text-muted">
                A modal Radix Dialogra épül; Escape és háttér-klikk zár.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="secondary"
                size={34}
                onClick={() => setModalOpen(false)}
              >
                Mégse
              </Button>
              <Button
                variant="cta"
                size={34}
                onClick={() => {
                  setModalOpen(false);
                  toast.success("Bejegyzés létrehozva");
                }}
              >
                Létrehozás
              </Button>
            </ModalFooter>
          </ModalShell>
        </Modal>
      </Section>

      {/* 31. AlertDialog / ConfirmDialog */}
      <Section title="AlertDialog (ConfirmDialog)">
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size={34}>
              Törlés…
            </Button>
          }
          title="Végleges törlés?"
          description="Ez a művelet nem vonható vissza. A tartalom véglegesen törlődik."
          onConfirm={() => toast.error("Törölve")}
        />
        {/* Controlled instance, opened from the menu's danger row above. */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Jelenet törlése?"
          description="A jelenet és revíziói véglegesen törlődnek."
          onConfirm={() => toast.error("Jelenet törölve")}
        />
      </Section>

      {/* 32. Toast */}
      <Section title="Toast (Sonner)">
        <Button variant="success" size={32} onClick={() => toast.success("Mentve")}>
          success
        </Button>
        <Button variant="secondary" size={32} onClick={() => toast.info("Tudnivaló")}>
          info
        </Button>
        <Button
          variant="secondary"
          size={32}
          onClick={() => toast.warning("Ellenőrizd")}
        >
          warning
        </Button>
        <Button
          variant="destructive"
          size={32}
          onClick={() => toast.error("Hiba történt")}
        >
          error
        </Button>
      </Section>

      {/* 33. Tooltip */}
      <Section title="Tooltip">
        <Specimen label="surface">
          <Tooltip content="Zavarmentes írás">
            <IconButton size={32} aria-label="Fókusz mód">
              <Icon icon={PenLine} />
            </IconButton>
          </Tooltip>
        </Specimen>
        <Specimen label="dark">
          <Tooltip tone="dark" content="Sötét tooltip" side="right">
            <Button variant="secondary" size={30}>
              Hover
            </Button>
          </Tooltip>
        </Specimen>
      </Section>

      {/* 34. DashedTile / Dropzone */}
      <Section title="DashedTile / Dropzone">
        <Specimen label="add">
          <div className="w-56">
            <DashedTile
              size="add"
              icon={<Icon icon={Plus} size={20} />}
              label="Új könyv"
            />
          </div>
        </Specimen>
        <Specimen label="import">
          <div className="w-56">
            <DashedTile
              size="import"
              icon={<Icon icon={Upload} size={20} />}
              label="Húzd ide a fájlt"
              hint="DOCX / MD"
            />
          </div>
        </Specimen>
        <Specimen label="image">
          <div className="w-56">
            <DashedTile
              size="image"
              icon={<Icon icon={ImageIcon} size={22} />}
              label="Referenciakép"
            />
          </div>
        </Specimen>
        <Specimen label="portrait">
          <DashedTile
            size="portrait"
            icon={<Icon icon={ImageIcon} size={18} />}
            label="portré"
          />
        </Specimen>
        <Specimen label="cover">
          <DashedTile
            size="cover"
            icon={<Icon icon={Upload} size={18} />}
            label="borító"
          />
        </Specimen>
      </Section>

      {/* 35. AIResultCard */}
      <Section title="AIResultCard">
        <div className="w-[360px]">
          <AIResultCard
            label="Átírás"
            version="v1.2"
            model="ollama/llama3.2"
            contextEntities={[
              { label: "Szelene", icon: <Icon icon={User} size={11} /> },
              { label: "Nagykönyvtár", icon: <Icon icon={MapPin} size={11} /> },
            ]}
            body="Szelene meg sem rezzent. Ujjai lassan végigvándoroltak a tekercs peremén, míg el nem érték a rejtett jeleket — a vékony vonalak úgy parázslottak fel a sötétben, mint a hamu alatt őrzött zsarátnok."
            onAccept={() => toast.success("Elfogadva — revízió mentve")}
            onReject={() => toast("Elvetve")}
            onCopy={() => toast("Vágólapra másolva")}
            onStar={() => toast.success("Snippetbe mentve")}
          />
        </div>
      </Section>

      {/* 36. DiffPane (inside a modal trigger) */}
      <Section title="DiffPane">
        <Modal open={diffOpen} onOpenChange={setDiffOpen}>
          <ModalTrigger asChild>
            <Button variant="secondary" size={34}>
              Diff megnyitása
            </Button>
          </ModalTrigger>
          <ModalShell maxWidth={900} className="h-[600px] max-h-[88vh]">
            <ModalHeader title="Átírás — formálisabb hangvétel" />
            <DiffPane original={DIFF_ORIGINAL} suggestion={DIFF_SUGGESTION} />
            <ModalFooter>
              <Button variant="secondary" size={34} onClick={() => setDiffOpen(false)}>
                Elvetés
              </Button>
              <Button
                variant="success"
                size={34}
                onClick={() => {
                  setDiffOpen(false);
                  toast.success("Javaslat elfogadva");
                }}
              >
                Elfogadás
              </Button>
            </ModalFooter>
          </ModalShell>
        </Modal>
        <div className="mt-3 w-full">
          {/* Inline (non-modal) preview of the panes. */}
          <div className="flex h-48 overflow-hidden rounded-xl border border-border">
            <DiffPane original={DIFF_ORIGINAL} suggestion={DIFF_SUGGESTION} />
          </div>
        </div>
      </Section>

      {/* Mount the toaster once for the whole gallery. */}
      <Toaster />
    </main>
    </TooltipProvider>
  );
}
