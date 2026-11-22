import {
  B1ServiceSong,
  LayoutMode,
  NotationMode,
  UserConfig,
} from "../../types";
import { formatKeySignature } from "../../utils/music";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Columns3,
  LayoutGrid,
  AlignLeft,
  AlertCircle,
  Menu,
  Maximize2,
  StickyNote,
  RefreshCw,
  Pencil,
} from "lucide-react";

interface Props {
  song: B1ServiceSong;
  activeKey: string;
  isLocalKeyOverride: boolean;
  prevSong: B1ServiceSong | null;
  nextSong: B1ServiceSong | null;
  config: UserConfig;
  zoom: number;
  isRefreshing: boolean;
  showNoteEditor: boolean;
  hasNote: boolean;
  onSelectSong: (song: B1ServiceSong) => void;
  onChangeConfig: (next: UserConfig) => void;
  onAdjustZoom: (delta: number) => void;
  onOpenKeyModal: () => void;
  onOpenChordsModal: () => void;
  onReload: () => void;
  onToggleNoteEditor: () => void;
  onToggleFullScreen: () => void;
  onOpenMobileSidebar?: () => void;
}

export default function SongToolbar({
  song,
  activeKey,
  isLocalKeyOverride,
  prevSong,
  nextSong,
  config,
  zoom,
  isRefreshing,
  showNoteEditor,
  hasNote,
  onSelectSong,
  onChangeConfig,
  onAdjustZoom,
  onOpenKeyModal,
  onOpenChordsModal,
  onReload,
  onToggleNoteEditor,
  onToggleFullScreen,
  onOpenMobileSidebar,
}: Props) {
  const hasTone = Boolean(activeKey && activeKey.trim() !== "");
  const displayKey = formatKeySignature(
    activeKey,
    config.accidentalPreference || "auto"
  );

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-4 lg:px-5 py-1.5 min-h-14 border-b border-border bg-background/90 backdrop-blur-md flex-nowrap w-full">
      {/* Left: Mobile Menu + Prev/Next + Title + Clickable Key Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
        {onOpenMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
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

          <button
            type="button"
            onClick={onOpenKeyModal}
            title="Manage keys & tone"
            className="shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            {hasTone ? (
              <Badge className="font-mono text-xs px-1.5 py-0.5 gap-0.5 hover:opacity-90">
                <span>{displayKey}</span>
                {isLocalKeyOverride && (
                  <span className="text-[10px] opacity-80">*</span>
                )}
                <ChevronDown className="size-3 no-scale opacity-75" />
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 text-xs text-amber-500 border-amber-500/40 px-1.5 py-0.5 hover:bg-amber-500/10"
              >
                <AlertCircle className="size-3 no-scale" />
                <span className="hidden sm:inline">NNS</span>
                <ChevronDown className="size-3 no-scale opacity-75" />
              </Badge>
            )}
          </button>

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

      {/* Right: 5 | V | G + Layout + Zoom + Reload + Edit + Notes + Fullscreen */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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

        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 px-1 py-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 lg:size-6"
            onClick={() => onAdjustZoom(-2)}
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
            onClick={() => onAdjustZoom(2)}
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

        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={onReload}
          disabled={isRefreshing}
          title="Reload song from B1.church"
        >
          <RefreshCw
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={onOpenChordsModal}
          title="Edit Chords & Lyrics on B1.church"
        >
          <Pencil className="size-4" />
        </Button>

        <Button
          variant={showNoteEditor || hasNote ? "secondary" : "outline"}
          size="icon"
          className="size-8 relative shrink-0"
          onClick={onToggleNoteEditor}
          title="Song Notes (Saved locally)"
        >
          <StickyNote className="size-4" />
          {hasNote && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={onToggleFullScreen}
          title="Full Screen Chords Only (Press F)"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </header>
  );
}