import { useEffect } from "react";
import { B1ServiceSong, LayoutMode, NotationMode, UserConfig } from "../types";
import {
  isConfiguredSectionHeader,
  splitIntoSectionBlocks,
  transformChordProToken,
} from "../utils/music";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  AlignLeft,
  AlertCircle,
  Menu,
} from "lucide-react";

interface Props {
  song: B1ServiceSong;
  allSongsInService: B1ServiceSong[];
  config: UserConfig;
  onChangeConfig: (next: UserConfig) => void;
  onSelectSong: (song: B1ServiceSong) => void;
  onOpenMobileSidebar?: () => void;
}

export default function SongView({
  song,
  allSongsInService,
  config,
  onChangeConfig,
  onSelectSong,
  onOpenMobileSidebar,
}: Props) {
  const hasTone = Boolean(song.key_signature && song.key_signature.trim() !== "");
  const effectiveNotation: NotationMode =
    config.notation === "chords" && !hasTone ? "nashville" : config.notation;

  const zoom = config.zoom || 16;
  const currentIndex = allSongsInService.findIndex(
    (s) => s.plan_item_id === song.plan_item_id
  );
  const prevSong = currentIndex > 0 ? allSongsInService[currentIndex - 1] : null;
  const nextSong =
    currentIndex >= 0 && currentIndex < allSongsInService.length - 1
      ? allSongsInService[currentIndex + 1]
      : null;

  function adjustZoom(delta: number) {
    const nextZoom = Math.max(11, Math.min(36, zoom + delta));
    onChangeConfig({ ...config, zoom: nextZoom });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          adjustZoom(2);
        } else if (e.key === "-") {
          e.preventDefault();
          adjustZoom(-2);
        } else if (e.key === "0") {
          e.preventDefault();
          onChangeConfig({ ...config, zoom: 16 });
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoom, config]);

  function renderLine(line: string, lineIdx: number) {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lineIdx} className="h-[0.75em]" />;
    }

    if (isConfiguredSectionHeader(trimmed, config.sectionKeywords)) {
      const cleanHeader = trimmed.replace(/^\[|\]$/g, "");
      return (
        <div key={lineIdx} className="mt-[1em] mb-[0.4em]">
          <Badge
            variant="secondary"
            className="font-sans font-semibold uppercase tracking-wider text-[0.75em] px-2.5 py-0.5"
          >
            {cleanHeader}
          </Badge>
        </div>
      );
    }

    const regex = /(?:\[([^\]]+)\])?([^\[]*)/g;
    const segments: { chord: string; lyric: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match[0].length === 0) break;
      const rawBracket = match[1] || "";
      const convertedChord = rawBracket
        ? transformChordProToken(rawBracket, effectiveNotation, song.key_signature)
        : "";

      segments.push({
        chord: convertedChord,
        lyric: match[2] || "",
      });
    }

    const lineHasAnyChord = segments.some((s) => s.chord !== "");

    return (
      <div
        key={lineIdx}
        className="flex flex-wrap items-end font-mono leading-tight mb-[0.35em]"
      >
        {segments.map((seg, i) => (
          <span key={i} className="inline-flex flex-col whitespace-pre">
            {lineHasAnyChord && (
              <span className="font-bold text-primary min-h-[1.15em] tracking-tight">
                {seg.chord ? `${seg.chord} ` : " "}
              </span>
            )}
            <span className="text-foreground/95">{seg.lyric || " "}</span>
          </span>
        ))}
      </div>
    );
  }

  const blocks = splitIntoSectionBlocks(song.raw_chordpro, config.sectionKeywords);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Stage HUD Toolbar (Responsive on Phone, Tablet & Desktop) */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5 border-b border-border bg-background/90 backdrop-blur-md">
        {/* Left: Mobile Menu Button + Prev/Next + Song Title */}
        <div className="flex items-center gap-2 min-w-0">
          {onOpenMobileSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={onOpenMobileSidebar}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!prevSong}
              onClick={() => prevSong && onSelectSong(prevSong)}
              title={prevSong ? `Previous: ${prevSong.title}` : "First song"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!nextSong}
              onClick={() => nextSong && onSelectSong(nextSong)}
              title={nextSong ? `Next: ${nextSong.title}` : "Last song"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
                {song.title}
              </h1>
              {hasTone ? (
                <Badge className="font-mono text-[11px] px-1.5 py-0">
                  {song.key_signature}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] text-amber-500 border-amber-500/40"
                >
                  <AlertCircle className="h-3 w-3" />
                  NNS
                </Badge>
              )}
              {song.bpm && (
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex font-mono text-[11px]"
                >
                  {song.bpm} BPM
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: Notation + Layout + Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {/* Notation Switcher */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(["nashville", "chords", "roman"] as NotationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onChangeConfig({ ...config, notation: mode })}
                className={`px-2 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                  config.notation === mode
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "nashville" ? "NNS" : mode}
              </button>
            ))}
          </div>

          {/* Layout Switcher */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(
              [
                { id: "full", icon: AlignLeft, label: "Full" },
                { id: "columns", icon: Columns3, label: `${config.columnCount || 2}C` },
                { id: "blocks", icon: LayoutGrid, label: "Blocks" },
              ] as { id: LayoutMode; icon: any; label: string }[]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeConfig({ ...config, layout: item.id })}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${
                    config.layout === item.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 px-1 py-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => adjustZoom(-2)}
              title="Zoom Out (Cmd -)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono w-9 text-center">{zoom}px</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => adjustZoom(2)}
              title="Zoom In (Cmd +)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hidden sm:inline-flex"
              onClick={() => onChangeConfig({ ...config, zoom: 16 })}
              title="Reset Zoom (Cmd 0)"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Chord Sheet Canvas */}
      <div
        className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto"
        style={{ fontSize: `${zoom}px` }}
      >
        {/* Layout 1: Full Song */}
        {config.layout === "full" && (
          <div className="max-w-4xl mx-auto">
            {song.raw_chordpro.split(/\r?\n/).map((line, idx) => renderLine(line, idx))}
          </div>
        )}

        {/* Layout 2: Multi-Columns (collapses to 1 column on phones automatically) */}
        {config.layout === "columns" && (
          <div
            className="columns-1 md:columns-[var(--col-count)] gap-8"
            style={{ "--col-count": config.columnCount || 2 } as React.CSSProperties}
          >
            {blocks.map((block, bIdx) => (
              <div key={bIdx} className="break-inside-avoid mb-5">
                {block.header && (
                  <div className="mb-2">
                    <Badge
                      variant="secondary"
                      className="font-sans font-semibold uppercase tracking-wider text-[0.75em] px-2.5 py-0.5"
                    >
                      {block.header.replace(/^\[|\]$/g, "")}
                    </Badge>
                  </div>
                )}
                {block.lines.map((line, lIdx) => renderLine(line, lIdx))}
              </div>
            ))}
          </div>
        )}

        {/* Layout 3: Equal-Size Responsive Grid Blocks (Scales with Zoom!) */}
        {config.layout === "blocks" && (
          <div
            className="grid gap-4 items-stretch"
            style={{
              fontSize: `${zoom}px`,
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 19em), 1fr))",
            }}
          >
            {blocks.map((block, bIdx) => (
              <Card
                key={bIdx}
                style={{ fontSize: `${zoom}px` }}
                className="py-0 gap-0 overflow-hidden h-full flex flex-col bg-card/70 border-border/80 shadow-xs"
              >
                {block.header && (
                  <CardHeader className="py-2.5 px-4 border-b border-border/60 bg-muted/40 rounded-none">
                    <CardTitle
                      style={{ fontSize: "0.78em" }}
                      className="font-sans font-bold uppercase tracking-wider text-foreground/90 leading-none"
                    >
                      {block.header.replace(/^\[|\]$/g, "")}
                    </CardTitle>
                  </CardHeader>
                )}
                <CardContent
                  style={{ fontSize: `${zoom}px` }}
                  className="p-4 flex-1 flex flex-col justify-start"
                >
                  {block.lines.map((line, lIdx) => renderLine(line, lIdx))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}