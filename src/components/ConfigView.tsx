import { useState } from "react";
import { LayoutMode, NotationMode, UserConfig } from "../types";
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
  Sparkles,
} from "lucide-react";

interface Props {
  config: UserConfig;
  onChangeConfig: (next: UserConfig) => void;
}

export default function ConfigView({ config, onChangeConfig }: Props) {
  const [newSectionInput, setNewSectionInput] = useState("");

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
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Studio Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how B1.church Nashville charts are transformed and displayed on your screen.
        </p>
      </div>

      {/* 1. Chord Notation Format */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Chord Notation System</CardTitle>
          </div>
          <CardDescription>
            B1 stores charts in Nashville numbers by default. Choose how your screen renders them.
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
            ] as { id: NotationMode; title: string; sample: string; desc: string }[]
          ).map((opt) => {
            const active = config.notation === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setNotation(opt.id)}
                className={`flex flex-col justify-between p-4 rounded-xl border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{opt.title}</span>
                  </div>
                  <p className="font-mono text-xs text-primary font-bold mt-1.5">
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

      {/* 2. Chart Layout & Columns */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
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
                  title: "Flexbox Section Cards",
                  icon: LayoutGrid,
                  desc: "Wraps Verso, Coro, and Puente into responsive cards.",
                },
              ] as { id: LayoutMode; title: string; icon: any; desc: string }[]
            ).map((opt) => {
              const Icon = opt.icon;
              const active = config.layout === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{opt.title}</span>
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

      {/* 3. Section Header Keywords */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Song Section Headers</CardTitle>
          </div>
          <CardDescription>
            Bracketed lines matching these keywords (like [Coro] or [Verso 1]) split your song into visual blocks.
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
            />
            <Button type="submit" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {config.sectionKeywords.map((kw) => (
              <Badge
                key={kw}
                variant="secondary"
                className="pl-2.5 pr-1.5 py-1 text-xs flex items-center gap-1.5"
              >
                <span>{kw}</span>
                <button
                  onClick={() => removeSectionKeyword(kw)}
                  className="rounded-full p-0.5 hover:bg-foreground/15 transition-colors"
                  title={`Remove ${kw}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Appearance & Default Zoom */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Appearance & Stage Readability</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant={config.darkMode ? "default" : "outline"}
              onClick={() => onChangeConfig({ ...config, darkMode: true })}
              className="gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark Stage Mode
            </Button>
            <Button
              variant={!config.darkMode ? "default" : "outline"}
              onClick={() => onChangeConfig({ ...config, darkMode: false })}
              className="gap-2"
            >
              <Sun className="h-4 w-4" />
              Light Paper Mode
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Default Font Size:</span>
            <Badge variant="outline" className="font-mono">
              {config.zoom || 16}px
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}