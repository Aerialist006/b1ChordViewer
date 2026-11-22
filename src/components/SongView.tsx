import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  B1ServiceSong,
  NotationMode,
  ParsedBlock,
  UserConfig,
} from "../types";
import { splitIntoSectionBlocks } from "../utils/music";
import {
  getSongStorageKey,
  LOCAL_KEYS_STORAGE_KEY,
  NOTES_STORAGE_KEY,
  readLocalMap,
  writeLocalMapEntry,
} from "../utils/storage";
import SongToolbar from "./song/SongToolbar";
import SongFullScreenControls from "./song/SongFullScreenControls";
import SongKeyModal from "./song/SongKeyModal";
import SongChordsEditorModal from "./song/SongChordsEditorModal";
import ChordSheetLine from "./song/ChordSheetLine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StickyNote, X, RefreshCw } from "lucide-react";

interface Props {
  song: B1ServiceSong;
  activePlanId: string;
  allSongsInService: B1ServiceSong[];
  config: UserConfig;
  isFullScreen: boolean;
  onToggleFullScreen: (next?: boolean) => void;
  onChangeConfig: (next: UserConfig) => void;
  onSelectSong: (song: B1ServiceSong) => void;
  onReloadSong: (preferredPlanItemId?: string) => Promise<void>;
  onSongUpdated: (updated: B1ServiceSong) => void;
  onOpenMobileSidebar?: () => void;
}

const PULL_THRESHOLD = 68;

export default function SongView({
  song,
  activePlanId,
  allSongsInService,
  config,
  isFullScreen,
  onToggleFullScreen,
  onChangeConfig,
  onSelectSong,
  onReloadSong,
  onSongUpdated,
  onOpenMobileSidebar,
}: Props) {
  const storageKey = getSongStorageKey(song);
  const accidentalPref = config.accidentalPreference || "auto";

  const [localKeyOverride, setLocalKeyOverride] = useState<string | null>(() => {
    return readLocalMap(LOCAL_KEYS_STORAGE_KEY)[storageKey] ?? null;
  });

  const activeKey =
    localKeyOverride !== null ? localKeyOverride : song.key_signature;
  const hasTone = Boolean(activeKey && activeKey.trim() !== "");
  const effectiveNotation: NotationMode =
    config.notation === "chords" && !hasTone ? "nashville" : config.notation;

  const zoom = config.zoom || 16;
  const [blocks, setBlocks] = useState<ParsedBlock[]>([]);

  const [noteText, setNoteText] = useState<string>(
    () => readLocalMap(NOTES_STORAGE_KEY)[storageKey] || ""
  );
  const [showNoteEditor, setShowNoteEditor] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(zoom);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showChordsModal, setShowChordsModal] = useState(false);

  useEffect(() => {
    const loadedNote = readLocalMap(NOTES_STORAGE_KEY)[storageKey] || "";
    setNoteText(loadedNote);
    setShowNoteEditor(Boolean(loadedNote.trim()));

    const loadedKey = readLocalMap(LOCAL_KEYS_STORAGE_KEY)[storageKey] ?? null;
    setLocalKeyOverride(loadedKey);
  }, [storageKey]);

  useEffect(() => {
    setBlocks(
      splitIntoSectionBlocks(
        song.raw_chordpro,
        config.sectionKeywords,
        config.layout === "blocks"
      )
    );
  }, [song.raw_chordpro, config.sectionKeywords, config.layout]);

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

  function handleNoteChange(val: string) {
    setNoteText(val);
    writeLocalMapEntry(NOTES_STORAGE_KEY, storageKey, val);
  }

  function handleApplyLocalKey(nextKey: string) {
    const cleaned = nextKey.trim();
    if (cleaned === song.key_signature.trim()) {
      setLocalKeyOverride(null);
      writeLocalMapEntry(LOCAL_KEYS_STORAGE_KEY, storageKey, null);
    } else {
      setLocalKeyOverride(cleaned);
      writeLocalMapEntry(LOCAL_KEYS_STORAGE_KEY, storageKey, cleaned);
    }
    setShowKeyModal(false);
  }

  function handleResetLocalKey() {
    setLocalKeyOverride(null);
    writeLocalMapEntry(LOCAL_KEYS_STORAGE_KEY, storageKey, null);
    setShowKeyModal(false);
  }

  async function triggerReload(preferredPlanItemId?: string) {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onReloadSong(preferredPlanItemId);
    } finally {
      setIsRefreshing(false);
    }
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

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      startYRef.current = null;
      setPullDistance(0);
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchStartDistRef.current = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      pinchStartZoomRef.current = zoom;
      return;
    }

    if (e.touches.length === 1 && !isRefreshing) {
      const scrollTop = canvasRef.current ? canvasRef.current.scrollTop : 0;
      startYRef.current = scrollTop <= 2 ? e.touches[0].clientY : null;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const currentDist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      const nextZoom = Math.round(
        Math.max(
          11,
          Math.min(
            36,
            pinchStartZoomRef.current * (currentDist / pinchStartDistRef.current)
          )
        )
      );
      if (nextZoom !== zoom) {
        onChangeConfig({ ...config, zoom: nextZoom });
      }
      return;
    }

    if (e.touches.length === 1 && startYRef.current !== null && !isRefreshing) {
      const scrollTop = canvasRef.current ? canvasRef.current.scrollTop : 0;
      const deltaY = e.touches[0].clientY - startYRef.current;
      setPullDistance(deltaY > 0 && scrollTop <= 2 ? Math.min(110, deltaY * 0.45) : 0);
    }
  }

  async function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
    if (startYRef.current !== null && e.touches.length === 0) {
      startYRef.current = null;
      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setPullDistance(52);
        await triggerReload();
        setPullDistance(0);
      } else {
        setPullDistance(0);
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

      if (e.key === "Escape") {
        if (showChordsModal) {
          setShowChordsModal(false);
          return;
        }
        if (showKeyModal) {
          setShowKeyModal(false);
          return;
        }
        if (isFullScreen) {
          e.preventDefault();
          handleFullScreenToggle();
          return;
        }
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
  }, [zoom, config, isFullScreen, showChordsModal, showKeyModal]);

  return (
    <div className="flex flex-col h-full relative">
      {!isFullScreen && (
        <SongToolbar
          song={song}
          activeKey={activeKey}
          isLocalKeyOverride={localKeyOverride !== null}
          prevSong={prevSong}
          nextSong={nextSong}
          config={config}
          zoom={zoom}
          isRefreshing={isRefreshing}
          showNoteEditor={showNoteEditor}
          hasNote={noteText.trim() !== ""}
          onSelectSong={onSelectSong}
          onChangeConfig={onChangeConfig}
          onAdjustZoom={adjustZoom}
          onOpenKeyModal={() => setShowKeyModal(true)}
          onOpenChordsModal={() => setShowChordsModal(true)}
          onReload={() => triggerReload()}
          onToggleNoteEditor={() => setShowNoteEditor((prev) => !prev)}
          onToggleFullScreen={handleFullScreenToggle}
          onOpenMobileSidebar={onOpenMobileSidebar}
        />
      )}

      {showNoteEditor && !isFullScreen && (
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

      {isFullScreen && (
        <SongFullScreenControls
          prevSong={prevSong}
          nextSong={nextSong}
          zoom={zoom}
          onSelectSong={onSelectSong}
          onAdjustZoom={adjustZoom}
          onExitFullScreen={handleFullScreenToggle}
        />
      )}

      {showKeyModal && (
        <SongKeyModal
          song={song}
          activePlanId={activePlanId}
          activeKey={activeKey}
          isLocalOverride={localKeyOverride !== null}
          apiKey={config.apiKey}
          accidentalPreference={accidentalPref}
          onClose={() => setShowKeyModal(false)}
          onApplyLocalKey={handleApplyLocalKey}
          onResetLocalKey={handleResetLocalKey}
          onPlanItemReplaced={async (newPlanItemId) => {
            setLocalKeyOverride(null);
            writeLocalMapEntry(LOCAL_KEYS_STORAGE_KEY, storageKey, null);
            await onReloadSong(newPlanItemId);
          }}
        />
      )}

      {showChordsModal && (
        <SongChordsEditorModal
          song={song}
          activeKey={activeKey}
          apiKey={config.apiKey}
          accidentalPreference={accidentalPref}
          onClose={() => setShowChordsModal(false)}
          onSaved={(newLyrics) =>
            onSongUpdated({ ...song, raw_chordpro: newLyrics })
          }
        />
      )}

      {/* Main Chord Sheet Canvas */}
      <div
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto"
        style={{ fontSize: `${zoom}px`, touchAction: "pan-y" }}
      >
        {(pullDistance > 0 || isRefreshing) && (
          <div
            style={{
              height: `${Math.max(pullDistance, isRefreshing ? 44 : 0)}px`,
            }}
            className="flex items-center justify-center overflow-hidden transition-all duration-150 mb-2"
          >
            <div className="flex items-center gap-2 text-xs font-sans font-medium text-muted-foreground bg-muted/60 px-3.5 py-1.5 rounded-full border border-border shadow-xs">
              <RefreshCw
                className={`size-4 text-primary no-scale ${
                  isRefreshing ? "animate-spin" : ""
                }`}
                style={{
                  transform: !isRefreshing
                    ? `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)`
                    : undefined,
                }}
              />
              <span>
                {isRefreshing
                  ? "Reloading song..."
                  : pullDistance >= PULL_THRESHOLD
                    ? "Release to reload"
                    : "Pull down to reload"}
              </span>
            </div>
          </div>
        )}

        {config.layout === "full" && (
          <div className="max-w-4xl mx-auto">
            {song.raw_chordpro.split(/\r?\n/).map((line, idx) => (
              <ChordSheetLine
                key={idx}
                line={line}
                sectionKeywords={config.sectionKeywords}
                notation={effectiveNotation}
                activeKey={activeKey}
                accidentalPreference={accidentalPref}
              />
            ))}
          </div>
        )}

        {config.layout === "columns" && (
          <div
            className="columns-1 md:columns-(--col-count) gap-6"
            style={
              { "--col-count": config.columnCount || 2 } as React.CSSProperties
            }
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
                {block.lines.map((line, lIdx) => (
                  <ChordSheetLine
                    key={lIdx}
                    line={line}
                    sectionKeywords={config.sectionKeywords}
                    notation={effectiveNotation}
                    activeKey={activeKey}
                    accidentalPreference={accidentalPref}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {config.layout === "blocks" && (
          <div
            className="grid gap-3 sm:gap-4 items-stretch"
            style={{
              fontSize: `${zoom}px`,
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 18em), 1fr))",
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
                  {block.lines.map((line, lIdx) => (
                    <ChordSheetLine
                      key={lIdx}
                      line={line}
                      sectionKeywords={config.sectionKeywords}
                      notation={effectiveNotation}
                      activeKey={activeKey}
                      accidentalPreference={accidentalPref}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}