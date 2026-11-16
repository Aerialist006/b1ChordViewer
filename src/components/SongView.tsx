import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  B1ServiceSong,
  LayoutMode,
  NotationMode,
  ParsedBlock,
  UserConfig,
} from "../types";
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
  Maximize2,
  Minimize2,
} from "lucide-react";

interface Props {
  song: B1ServiceSong;
  allSongsInService: B1ServiceSong[];
  config: UserConfig;
  isFullScreen: boolean;
  onToggleFullScreen: (next?: boolean) => void;
  onChangeConfig: (next: UserConfig) => void;
  onSelectSong: (song: B1ServiceSong) => void;
  onOpenMobileSidebar?: () => void;
}

export default function SongView({
  song,
  allSongsInService,
  config,
  isFullScreen,
  onToggleFullScreen,
  onChangeConfig,
  onSelectSong,
  onOpenMobileSidebar,
}: Props) {
  const hasTone = Boolean(song.key_signature && song.key_signature.trim() !== "");
  const effectiveNotation: NotationMode =
    config.notation === "chords" && !hasTone ? "nashville" : config.notation;

  const zoom = config.zoom || 16;
  const [blocks, setBlocks] = useState<ParsedBlock[]>([]);

  const currentIndex = allSongsInService.findIndex(
    (s) => s.plan_item_id === song.plan_item_id
  );
  const prevSong = currentIndex > 0 ? allSongsInService[currentIndex - 1] : null;
  const nextSong =
    currentIndex >= 0 && currentIndex < allSongsInService.length - 1
      ? allSongsInService[currentIndex + 1]
      : null;

  useEffect(() => {
    const shouldDeduplicate = config.layout === "blocks";
    invoke<ParsedBlock[]>("parse_and_deduplicate_blocks", {
      rawChordpro: song.raw_chordpro,
      sectionKeywords: config.sectionKeywords,
      deduplicate: shouldDeduplicate,
    })
      .then((res) => setBlocks(res))
      .catch(() => {
        setBlocks(splitIntoSectionBlocks(song.raw_chordpro, config.sectionKeywords));
      });
  }, [song.raw_chordpro, config.sectionKeywords, config.layout]);

  function adjustZoom(delta: number) {
    const nextZoom = Math.max(11, Math.min(36, zoom + delta));
    onChangeConfig({ ...config, zoom: nextZoom });
  }

  async function handleFullScreenToggle() {
    const nextState = !isFullScreen;
    onToggleFullScreen(nextState);

    try {
      const win = getCurrentWindow();
      await win.setFullscreen(nextState);
    } catch {
      try {
        if (nextState && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (!nextState && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // Handled by React layout state on mobile WebViews
      }
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Escape" && isFullScreen) {
        e.preventDefault();
        handleFullScreenToggle();
        return;
      }

      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleFullScreenToggle();
        return;
      }

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
  }, [zoom, config, isFullScreen]);

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
    const wordTokens: { chord: string; text: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match[0].length === 0) break;
      const rawBracket = match[1] || "";
      const convertedChord = rawBracket
        ? transformChordProToken(rawBracket, effectiveNotation, song.key_signature)
        : "";
      const lyricChunk = match[2] || "";

      const wordParts = lyricChunk.match(/\S+\s*|\s+/g) || [""];
      wordParts.forEach((part, idx) => {
        wordTokens.push({
          chord: idx === 0 ? convertedChord : "",
          text: part,
        });
      });
    }

    const lineHasAnyChord = wordTokens.some((t) => t.chord !== "");

    return (
      <div
        key={lineIdx}
        className="flex flex-wrap items-end font-mono leading-tight mb-[0.35em] max-w-full break-words"
      >
        {wordTokens.map((tok, i) => (
          <span key={i} className="inline-flex flex-col whitespace-pre-wrap max-w-full">
            {lineHasAnyChord && (
              <span
                style={{ color: "var(--chord-color)" }}
                className="font-bold min-h-[1.15em] tracking-tight"
              >
                {tok.chord ? `${tok.chord} ` : "\u00A0"}
              </span>
            )}
            <span className="text-foreground/95 break-words min-h-[1.15em]">
              {tok.text || "\u00A0"}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Sticky Stage HUD Toolbar — min-h-14 aligns border with AppSidebar h-14 */}
      {!isFullScreen && (
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-1.5 min-h-14 border-b border-border bg-background/90 backdrop-blur-md">
          {/* Left: Mobile Menu + Prev/Next + Song Title */}
          <div className="flex items-center gap-2 min-w-0">
            {onOpenMobileSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden size-9 shrink-0"
                onClick={onOpenMobileSidebar}
                title="Open Setlist Menu"
              >
                <Menu className="size-5" />
              </Button>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="size-9 lg:size-8"
                disabled={!prevSong}
                onClick={() => prevSong && onSelectSong(prevSong)}
                title={prevSong ? `Previous: ${prevSong.title}` : "First song"}
              >
                <ChevronLeft className="size-5 lg:size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 lg:size-8"
                disabled={!nextSong}
                onClick={() => nextSong && onSelectSong(nextSong)}
                title={nextSong ? `Next: ${nextSong.title}` : "Last song"}
              >
                <ChevronRight className="size-5 lg:size-4" />
              </Button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight truncate">
                  {song.title}
                </h1>
                {hasTone ? (
                  <Badge className="font-mono text-xs px-2 py-0">
                    {song.key_signature}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 text-xs text-amber-500 border-amber-500/40"
                  >
                    <AlertCircle className="size-3.5" />
                    NNS
                  </Badge>
                )}
                {song.bpm && (
                  <Badge
                    variant="secondary"
                    className="hidden sm:inline-flex font-mono text-xs"
                  >
                    {song.bpm} BPM
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Notation + Layout + Zoom + Full Screen Button */}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
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
                    className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all ${
                      config.layout === item.id
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 lg:size-3.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6"
                onClick={() => adjustZoom(-2)}
                title="Zoom Out (Cmd -)"
              >
                <ZoomOut className="size-4 lg:size-3.5" />
              </Button>
              <span className="text-xs font-mono w-9 text-center">{zoom}px</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6"
                onClick={() => adjustZoom(2)}
                title="Zoom In (Cmd +)"
              >
                <ZoomIn className="size-4 lg:size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6 hidden sm:inline-flex"
                onClick={() => onChangeConfig({ ...config, zoom: 16 })}
                title="Reset Zoom (Cmd 0)"
              >
                <RotateCcw className="size-3.5 lg:size-3" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="size-9 lg:size-8"
              onClick={handleFullScreenToggle}
              title="Full Screen Chords Only (Press F)"
            >
              <Maximize2 className="size-5 lg:size-4" />
            </Button>
          </div>
        </header>
      )}

      {/* Floating Controls in Full Screen Mode */}
      {isFullScreen && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-full border border-border/80 bg-background/85 backdrop-blur-md p-1.5 shadow-lg"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            right: "calc(env(safe-area-inset-right, 0px) + 12px)",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-9 lg:size-8 rounded-full"
            disabled={!prevSong}
            onClick={() => prevSong && onSelectSong(prevSong)}
            title="Previous Song"
          >
            <ChevronLeft className="size-5 lg:size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 lg:size-8 rounded-full"
            disabled={!nextSong}
            onClick={() => nextSong && onSelectSong(nextSong)}
            title="Next Song"
          >
            <ChevronRight className="size-5 lg:size-4" />
          </Button>

          <div className="h-5 w-px bg-border mx-0.5" />

          <Button
            variant="ghost"
            size="icon"
            className="size-9 lg:size-8 rounded-full"
            onClick={() => adjustZoom(-2)}
            title="Zoom Out (Cmd -)"
          >
            <ZoomOut className="size-5 lg:size-4" />
          </Button>
          <span className="text-xs font-mono px-1 text-muted-foreground select-none">
            {zoom}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 lg:size-8 rounded-full"
            onClick={() => adjustZoom(2)}
            title="Zoom In (Cmd +)"
          >
            <ZoomIn className="size-5 lg:size-4" />
          </Button>

          <div className="h-5 w-px bg-border mx-0.5" />

          <Button
            variant="secondary"
            size="icon"
            className="size-9 lg:size-8 rounded-full"
            onClick={handleFullScreenToggle}
            title="Exit Full Screen (Esc)"
          >
            <Minimize2 className="size-5 lg:size-4" />
          </Button>
        </div>
      )}

      {/* Main Chord Sheet Canvas — Compact p-3 on mobile/tablet so cards fit comfortably */}
      <div
        className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto"
        style={{ fontSize: `${zoom}px` }}
      >
        {config.layout === "full" && (
          <div className="max-w-4xl mx-auto">
            {song.raw_chordpro.split(/\r?\n/).map((line, idx) => renderLine(line, idx))}
          </div>
        )}

        {config.layout === "columns" && (
          <div
            className="columns-1 md:columns-[var(--col-count)] gap-6"
            style={{ "--col-count": config.columnCount || 2 } as React.CSSProperties}
          >
            {blocks.map((block, bIdx) => (
              <div key={bIdx} className="break-inside-avoid mb-4">
                {block.header && (
                  <div className="mb-1.5">
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

        {config.layout === "blocks" && (
          <div
            className="grid gap-3 sm:gap-4 items-stretch"
            style={{
              fontSize: `${zoom}px`,
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18em), 1fr))",
            }}
          >
            {blocks.map((block, bIdx) => (
              <Card
                key={bIdx}
                style={{ fontSize: `${zoom}px` }}
                className="py-0 gap-0 overflow-hidden h-full min-w-0 flex flex-col bg-card/70 border-border/80 shadow-xs"
              >
                {block.header && (
                  <CardHeader className="py-2 px-3.5 border-b border-border/60 bg-muted/40 rounded-none">
                    <CardTitle
                      style={{ fontSize: "0.78em" }}
                      className="font-sans font-bold uppercase tracking-wider text-foreground/90 leading-none truncate"
                    >
                      {block.header.replace(/^\[|\]$/g, "")}
                    </CardTitle>
                  </CardHeader>
                )}
                <CardContent
                  style={{ fontSize: `${zoom}px` }}
                  className="p-3.5 flex-1 min-w-0 flex flex-col justify-start overflow-x-hidden"
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