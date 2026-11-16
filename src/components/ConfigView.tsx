import { useState } from "react";
import {
  LayoutMode,
  NotationMode,
  PASTEL_PRESETS,
  PastelColorId,
  UserConfig,
} from "../types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Music,
  LayoutGrid,
  Columns3,
  AlignLeft,
  Plus,
  X,
  Sun,
  Moon,
  Tags,
  Palette,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
} from "lucide-react";

interface Props {
  config: UserConfig;
  onChangeConfig: (next: UserConfig) => void;
  onSaveApiKeyAndSync: (newKey: string) => void;
}

export default function ConfigView({
  config,
  onChangeConfig,
  onSaveApiKeyAndSync,
}: Props) {
  const [newSectionInput, setNewSectionInput] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState(config.apiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);

  function setNotation(notation: NotationMode) {
    onChangeConfig({ ...config, notation });
  }

  function setLayout(layout: LayoutMode) {
    onChangeConfig({ ...config, layout });
  }

  function setColumnCount(count: number) {
    const clamped = Math.max(1, Math.min(6, count));
    onChangeConfig({ ...config, columnCount: clamped });
  }

  function addSectionKeyword() {
    const cleaned = newSectionInput.trim();
    if (!cleaned) return;
    if (!config.sectionKeywords.includes(cleaned)) {
      onChangeConfig({
        ...config,
        sectionKeywords: [...config.sectionKeywords, cleaned],
      });
    }
    setNewSectionInput("");
  }

  function removeSectionKeyword(kw: string) {
    onChangeConfig({
      ...config,
      sectionKeywords: config.sectionKeywords.filter((item) => item !== kw),
    });
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">
          Studio Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Configure your church's B1 API connection, pastel stage palette, and
          chord layout.
        </p>
      </div>

      {/* 0. ChurchApps (B1) API Key Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-5 lg:size-4 text-primary shrink-0" />
            <CardTitle className="text-base">
              ChurchApps (B1.church) API Key
            </CardTitle>
          </div>
          <CardDescription>
            Enter your church's B1 API token (starts with{" "}
            <code className="font-mono">cak_</code>) to sync your service plans
            and chord charts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveApiKeyAndSync(apiKeyDraft.trim());
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder="cak_your_church_api_key_here..."
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                className="pr-10 font-mono text-xs h-10 lg:h-9"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={showApiKey ? "Hide API Key" : "Show API Key"}
              >
                {showApiKey ? (
                  <EyeOff className="size-5 lg:size-4" />
                ) : (
                  <Eye className="size-5 lg:size-4" />
                )}
              </button>
            </div>
            <Button type="submit" className="gap-2 shrink-0 h-10 lg:h-9">
              <RefreshCw className="size-5 lg:size-4" />
              Save & Sync B1
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 1. Chill Pastel Theme & Chord Color Studio */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Palette className="size-5 lg:size-4 text-primary shrink-0" />
              <CardTitle className="text-base">
                Pastel Stage Palette & Chord Colors
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={config.darkMode ? "default" : "outline"}
                onClick={() => onChangeConfig({ ...config, darkMode: true })}
                className="gap-1.5 h-9 lg:h-8"
              >
                <Moon className="size-4 lg:size-3.5" />
                Dark
              </Button>
              <Button
                size="sm"
                variant={!config.darkMode ? "default" : "outline"}
                onClick={() => onChangeConfig({ ...config, darkMode: false })}
                className="gap-1.5 h-9 lg:h-8"
              >
                <Sun className="size-4 lg:size-3.5" />
                Light
              </Button>
            </div>
          </div>
          <CardDescription>
            Mix and match soft pastel colors for your app's UI accent and your
            chord symbols.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Accent Color Palette */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              UI Accent
            </label>
            <div className="flex flex-wrap pt-1 items-center gap-3">
              {PASTEL_PRESETS.map((preset) => {
                const isSelected =
                  (config.accentColor || "lavender") === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChangeConfig({
                        ...config,
                        accentColor: preset.id as PastelColorId,
                      })
                    }
                    style={{ backgroundColor: preset.swatch }}
                    className={`size-9 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110 shadow-sm"
                        : "opacity-80 hover:opacity-100 hover:scale-105 border border-black/15"
                    }`}
                  >
                    {isSelected && (
                      <Check className="size-4 text-zinc-900 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chord Color Palette */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chords
            </label>
            <div className="flex flex-wrap pt-1 items-center gap-3">
              {PASTEL_PRESETS.map((preset) => {
                const isSelected = (config.chordColor || "peach") === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChangeConfig({
                        ...config,
                        chordColor: preset.id as PastelColorId,
                      })
                    }
                    style={{ backgroundColor: preset.swatch }}
                    className={`size-9 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110 shadow-sm"
                        : "opacity-80 hover:opacity-100 hover:scale-105 border border-black/15"
                    }`}
                  >
                    {isSelected && (
                      <Check className="size-4 text-zinc-900 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Mini Preview */}
          <div className="rounded-xl border border-border bg-card/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-mono text-sm leading-tight">
              <div className="flex flex-wrap items-end">
                <span className="inline-flex flex-col mr-2">
                  <span
                    className="font-bold"
                    style={{ color: "var(--chord-color)" }}
                  >
                    {config.notation === "chords"
                      ? "Am "
                      : config.notation === "roman"
                        ? "vi "
                        : "6m "}
                  </span>
                  <span>The King of Glory, </span>
                </span>
                <span className="inline-flex flex-col mr-2">
                  <span
                    className="font-bold"
                    style={{ color: "var(--chord-color)" }}
                  >
                    {config.notation === "chords"
                      ? "G "
                      : config.notation === "roman"
                        ? "V "
                        : "5 "}
                  </span>
                  <span>the King above all kings </span>
                </span>
                <span className="inline-flex flex-col">
                  <span
                    className="font-bold"
                    style={{ color: "var(--chord-color)" }}
                  >
                    {config.notation === "chords"
                      ? "Fmaj7 "
                      : config.notation === "roman"
                        ? "IVmaj7 "
                        : "4maj7 "}
                  </span>
                  <span>{"\u00A0"}</span>
                </span>
              </div>
            </div>
            <Badge className="self-start sm:self-center shrink-0">
              Active Accent Preview
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. Chord Notation System */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Music className="size-5 lg:size-4 text-primary shrink-0" />
            <CardTitle className="text-base">Chord Notation System</CardTitle>
          </div>
          <CardDescription>
            B1 stores charts in Nashville numbers by default. Choose how your
            screen renders them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              {
                id: "nashville",
                title: "Nashville Numbers",
                sample: "1 · 4 · 5 · 6m",
                desc: "Displays scale degrees relative to the song key.",
              },
              {
                id: "chords",
                title: "Standard Chords",
                sample: "C · F · G · Am",
                desc: "Auto-transposes from song tone (falls back to Nashville if tone is blank).",
              },
              {
                id: "roman",
                title: "Roman Numerals",
                sample: "I · IV · V · vi",
                desc: "Classical harmonic analysis with lowercase minor chords.",
              },
            ] as {
              id: NotationMode;
              title: string;
              sample: string;
              desc: string;
            }[]
          ).map((opt) => {
            const active = config.notation === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setNotation(opt.id)}
                className={`flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <div>
                  <span className="font-semibold text-sm">{opt.title}</span>
                  <p
                    className="font-mono text-xs font-bold mt-1.5"
                    style={{ color: "var(--chord-color)" }}
                  >
                    {opt.sample}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* 3. Stage Layout Mode */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="size-5 lg:size-4 text-primary shrink-0" />
            <CardTitle className="text-base">Stage Layout Mode</CardTitle>
          </div>
          <CardDescription>
            Choose how song sections flow across your monitor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                {
                  id: "full",
                  title: "Full Vertical Scroll",
                  icon: AlignLeft,
                  desc: "Single continuous column from Intro to Outro.",
                },
                {
                  id: "columns",
                  title: "Multi-Column Newspaper",
                  icon: Columns3,
                  desc: "Splits long songs across 2 to 6 vertical columns.",
                },
                {
                  id: "blocks",
                  title: "Deduplicated Section Cards",
                  icon: LayoutGrid,
                  desc: "Wraps unique Verso, Coro, and Puente sections into responsive cards.",
                },
              ] as { id: LayoutMode; title: string; icon: any; desc: string }[]
            ).map((opt) => {
              const Icon = opt.icon;
              const active = config.layout === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  className={`flex flex-col p-3.5 rounded-xl border text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="size-5 lg:size-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm leading-5">
                      {opt.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {config.layout === "columns" && (
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Number of Columns</p>
                <p className="text-xs text-muted-foreground">
                  Choose how many columns to display side-by-side (1–6)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[2, 3, 4].map((num) => (
                  <Button
                    key={num}
                    size="sm"
                    variant={config.columnCount === num ? "default" : "outline"}
                    onClick={() => setColumnCount(num)}
                  >
                    {num} Cols
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={config.columnCount || 2}
                  onChange={(e) => setColumnCount(Number(e.target.value))}
                  className="w-16 text-center font-mono"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Song Section Headers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Tags className="size-5 lg:size-4 text-primary shrink-0" />
            <CardTitle className="text-base">Song Section Headers</CardTitle>
          </div>
          <CardDescription>
            Bracketed lines matching these keywords (like [Coro] or [Verso 1])
            split your song into visual blocks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSectionKeyword();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Add custom section header (e.g. Estribillo, Interludio, Espontáneo)..."
              value={newSectionInput}
              onChange={(e) => setNewSectionInput(e.target.value)}
              className="h-10 lg:h-9"
            />
            <Button type="submit" className="gap-1.5 shrink-0 h-10 lg:h-9">
              <Plus className="size-5 lg:size-4" />
              Add Section
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {config.sectionKeywords.map((kw) => (
              <Badge
                key={kw}
                variant="secondary"
                className="pl-3 pr-2 py-1.5 text-sm lg:text-xs flex items-center gap-2"
              >
                <span>{kw}</span>
                <button
                  onClick={() => removeSectionKeyword(kw)}
                  className="rounded-full p-1 hover:bg-foreground/15 transition-colors"
                  title={`Remove ${kw}`}
                >
                  <X className="size-4 lg:size-3 no-scale" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}