import { B1ServiceSong } from "../../types";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomOut,
  ZoomIn,
  Minimize2,
} from "lucide-react";

interface Props {
  prevSong: B1ServiceSong | null;
  nextSong: B1ServiceSong | null;
  zoom: number;
  onSelectSong: (song: B1ServiceSong) => void;
  onAdjustZoom: (delta: number) => void;
  onExitFullScreen: () => void;
}

export default function SongFullScreenControls({
  prevSong,
  nextSong,
  zoom,
  onSelectSong,
  onAdjustZoom,
  onExitFullScreen,
}: Props) {
  return (
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
        onClick={() => onAdjustZoom(-2)}
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
        onClick={() => onAdjustZoom(2)}
        title="Zoom In (Cmd +)"
      >
        <ZoomIn className="size-5 lg:size-4" />
      </Button>

      <div className="h-5 w-px bg-border mx-0.5" />

      <Button
        variant="secondary"
        size="icon"
        className="size-9 lg:size-8 rounded-full"
        onClick={onExitFullScreen}
        title="Exit Full Screen (Esc)"
      >
        <Minimize2 className="size-5 lg:size-4" />
      </Button>
    </div>
  );
}