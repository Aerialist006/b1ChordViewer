import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  B1ServiceSong,
  LayoutMode,
  NotationMode,
  ParsedBlock,
  UserConfig,
} from "../types";
import {
  isChordToken,
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
  StickyNote,
  X,
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

const NOTES_STORAGE_KEY = "b1_song_notes";

function getSongNoteKey(song: B1ServiceSong): string {
  const anySong = song as unknown as Record<string, unknown>;
  return String(anySong.song_id || anySong.id || song.title || song.plan_item_id);
}

function readSongNote(key: string): string {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    return map[key] || "";
  } catch {
    return "";
  }
}

function writeSongNote(key: string, value: string) {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    if (value.trim() === "") {
      delete map[key];
    } else {
      map[key] = value;
    }
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
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

  // Lightweight local note per song
  const noteKey = getSongNoteKey(song);
  const [noteText, setNoteText] = useState<string>(() => readSongNote(noteKey));
  const [showNoteEditor, setShowNoteEditor] = useState<boolean>(false);

  useEffect(() => {
    const loaded = readSongNote(noteKey);
    setNoteText(loaded);
    setShowNoteEditor(Boolean(loaded.trim()));
  }, [noteKey]);

  function handleNoteChange(val: string) {
    setNoteText(val);
    writeSongNote(noteKey, val);
  }

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
    setBlocks(
      splitIntoSectionBlocks(
        song.raw_chordpro,
        config.sectionKeywords,
        shouldDeduplicate
      )
    );
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
      const lyricChunk = match[2] || "";

      // Only treat [...] as a chord if it starts with a number (1-7)
      const isChord = rawBracket ? isChordToken(rawBracket) : false;
      const convertedChord =
        rawBracket && isChord
          ? transformChordProToken(rawBracket, effectiveNotation, song.key_signature)
          : "";

      const combinedText =
        rawBracket && !isChord ? `[${rawBracket}] ${lyricChunk}` : lyricChunk;

      const wordParts = combinedText.match(/\S+\s*|\s+/g) || [""];
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
      {/* Sticky Stage HUD Toolbar — Always single filled row with ellipsis on song title */}
      {!isFullScreen && (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-2.5 sm:px-4 lg:px-5 py-1.5 min-h-14 border-b border-border bg-background/90 backdrop-blur-md flex-nowrap w-full">
          {/* Left: Mobile Menu + Prev/Next + Filled Title with Ellipsis + Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
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
                className="size-8"
                disabled={!prevSong}
                onClick={() => prevSong && onSelectSong(prevSong)}
                title={prevSong ? `Previous: ${prevSong.title}` : "First song"}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!nextSong}
                onClick={() => nextSong && onSelectSong(nextSong)}
                title={nextSong ? `Next: ${nextSong.title}` : "Last song"}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <h1
                className="text-sm sm:text-base lg:text-lg font-bold tracking-tight truncate min-w-0"
                title={song.title}
              >
                {song.title}
              </h1>
              {hasTone ? (
                <Badge className="font-mono text-xs px-1.5 py-0 shrink-0">
                  {song.key_signature}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs text-amber-500 border-amber-500/40 shrink-0 px-1.5 py-0"
                >
                  <AlertCircle className="size-3 no-scale" />
                  <span className="hidden sm:inline">NNS</span>
                </Badge>
              )}
              {song.bpm && (
                <Badge
                  variant="secondary"
                  className="hidden xl:inline-flex font-mono text-xs shrink-0"
                >
                  {song.bpm} BPM
                </Badge>
              )}
            </div>
          </div>

          {/* Right: 5 | V | G + Icon-Only Layout + Zoom (with px) + Notes + Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Chord Display Switcher: 5 | V | G on Mobile/Tablet, Full Labels on Desktop */}
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
              {(
                [
                  { id: "nashville", short: "5", full: "NNS" },
                  { id: "roman", short: "V", full: "Roman" },
                  { id: "chords", short: "G", full: "Chords" },
                ] as { id: NotationMode; short: string; full: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onChangeConfig({ ...config, notation: item.id })}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                    config.notation === item.id
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={`Notation: ${item.full}`}
                >
                  <span className="lg:hidden font-mono">{item.short}</span>
                  <span className="hidden lg:inline">{item.full}</span>
                </button>
              ))}
            </div>

            {/* Layout Switcher: Icons Only on Mobile/Tablet */}
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
              {(
                [
                  { id: "full", icon: AlignLeft, label: "Full" },
                  {
                    id: "columns",
                    icon: Columns3,
                    label: `${config.columnCount || 2}C`,
                  },
                  { id: "blocks", icon: LayoutGrid, label: "Blocks" },
                ] as { id: LayoutMode; icon: any; label: string }[]
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeConfig({ ...config, layout: item.id })}
                    title={`Layout: ${item.label}`}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all ${
                      config.layout === item.id
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 lg:size-3.5" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Zoom Control: Keeps px */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 px-1 py-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6"
                onClick={() => adjustZoom(-2)}
                title="Zoom Out (Cmd -)"
              >
                <ZoomOut className="size-4 lg:size-3.5" />
              </Button>
              <span className="text-xs font-mono px-1 text-center shrink-0">
                {zoom}px
              </span>
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
                className="size-7 lg:size-6 hidden lg:inline-flex"
                onClick={() => onChangeConfig({ ...config, zoom: 16 })}
                title="Reset Zoom (Cmd 0)"
              >
                <RotateCcw className="size-3.5 lg:size-3" />
              </Button>
            </div>

            {/* Client-Side Song Notes Toggle */}
            <Button
              variant={showNoteEditor || noteText.trim() ? "secondary" : "outline"}
              size="icon"
              className="size-8 relative shrink-0"
              onClick={() => setShowNoteEditor((prev) => !prev)}
              title="Song Notes (Saved locally)"
            >
              <StickyNote className="size-4" />
              {noteText.trim() !== "" && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
              )}
            </Button>

            {/* Full Screen Button */}
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={handleFullScreenToggle}
              title="Full Screen Chords Only (Press F)"
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </header>
      )}

      {/* Lightweight Local Song Note Bar */}
      {showNoteEditor && (
        <div className="flex items-start gap-2 px-3 sm:px-5 py-2 border-b border-border bg-muted/30">
          <StickyNote className="size-4 text-primary shrink-0 mt-1.5 no-scale" />
          <textarea
            value={noteText}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder={`Personal notes for "${song.title}" (cues, dynamics, capo, transitions)...`}
            rows={2}
            className="w-full flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none leading-snug"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNoteEditor(false)}
            title="Hide note panel"
          >
            <X className="size-3.5 no-scale" />
          </Button>
        </div>
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
            {zoom}px
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

      {/* Main Chord Sheet Canvas */}
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