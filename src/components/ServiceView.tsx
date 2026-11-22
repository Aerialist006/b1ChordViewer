import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { B1ServicePayload, B1ServiceSong, UserConfig } from "../types";
import { formatKeySignature, splitIntoSectionBlocks } from "../utils/music";
import AddSongModal from "./service/AddSongModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Search,
  Music,
  ChevronRight,
  Clock,
  Check,
  History,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  X,
  Plus,
} from "lucide-react";

interface Props {
  service: B1ServicePayload;
  config: UserConfig;
  onSelectSong: (song: B1ServiceSong) => void;
  onSelectPlan: (planId: string) => void;
  onRefresh: () => Promise<void> | void;
}

const PULL_THRESHOLD = 68;

export default function ServiceView({
  service,
  config,
  onSelectSong,
  onSelectPlan,
  onRefresh,
}: Props) {
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Order of Service state
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [draftSongs, setDraftSongs] = useState<B1ServiceSong[]>(service.songs);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const draggedIdxRef = useRef<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Pull-to-refresh state
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isEditingOrder) {
      setDraftSongs(service.songs);
      setRemovedIds([]);
    }
  }, [service.songs, isEditingOrder]);

  // Pointer-based drag & drop (works on macOS, Windows, and Android touch)
  useEffect(() => {
    if (draggedIdx === null) return;

    function handlePointerMove(e: PointerEvent) {
      const currentIdx = draggedIdxRef.current;
      if (currentIdx === null) return;

      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const cardEl = els.find((el) =>
        el.hasAttribute("data-order-idx")
      ) as HTMLElement | undefined;

      if (!cardEl) return;
      const targetIdx = Number(cardEl.dataset.orderIdx);
      if (Number.isNaN(targetIdx) || targetIdx === currentIdx) return;

      setDraftSongs((prev) => {
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(currentIdx, 1);
        next.splice(targetIdx, 0, moved);
        return next;
      });
      draggedIdxRef.current = targetIdx;
      setDraggedIdx(targetIdx);
    }

    function handlePointerUp() {
      draggedIdxRef.current = null;
      setDraggedIdx(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggedIdx !== null]);

  function handleDragHandlePointerDown(e: React.PointerEvent, idx: number) {
    if (!isEditingOrder || savingOrder) return;
    e.preventDefault();
    e.stopPropagation();
    draggedIdxRef.current = idx;
    setDraggedIdx(idx);
  }

  const filteredPlans = service.all_plans.filter((p) => {
    const label = `${p.name} ${p.service_date || ""}`.toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  const formattedDate = service.active_plan.service_date
    ? service.active_plan.service_date.slice(0, 10)
    : "Upcoming Service";

  const accidentalPref = config.accidentalPreference || "auto";

  async function triggerRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  function startEditingOrder() {
    setDraftSongs(service.songs);
    setRemovedIds([]);
    setOrderError("");
    setShowServicePicker(false);
    setIsEditingOrder(true);
  }

  function cancelEditingOrder() {
    setDraftSongs(service.songs);
    setRemovedIds([]);
    setOrderError("");
    draggedIdxRef.current = null;
    setDraggedIdx(null);
    setIsEditingOrder(false);
  }

  function moveSong(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= draftSongs.length || fromIdx === toIdx) return;
    setDraftSongs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function removeSongFromOrder(planItemId: string) {
    setDraftSongs((prev) => prev.filter((s) => s.plan_item_id !== planItemId));
    setRemovedIds((prev) => [...prev, planItemId]);
  }

  async function saveOrderToB1() {
    setSavingOrder(true);
    setOrderError("");
    try {
      await invoke("reorder_plan_songs", {
        planId: service.active_plan.id,
        orderedPlanItemIds: draftSongs.map((s) => s.plan_item_id),
        removedPlanItemIds: removedIds,
        apiToken: config.apiKey || null,
      });
      setIsEditingOrder(false);
      await onRefresh();
    } catch (e) {
      setOrderError(String(e));
    } finally {
      setSavingOrder(false);
    }
  }

  function getScrollTop(): number {
    const scrollParent = containerRef.current?.closest("main");
    return scrollParent ? scrollParent.scrollTop : window.scrollY;
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isRefreshing || isEditingOrder) return;
    if (getScrollTop() <= 2) {
      startYRef.current = e.touches[0].clientY;
    } else {
      startYRef.current = null;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startYRef.current === null || isRefreshing || isEditingOrder) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY > 0 && getScrollTop() <= 2) {
      setPullDistance(Math.min(110, deltaY * 0.45));
    } else {
      setPullDistance(0);
    }
  }

  async function handleTouchEnd() {
    if (startYRef.current === null || isRefreshing || isEditingOrder) return;
    startYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      setPullDistance(52);
      await triggerRefresh();
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  }

  const displayedSongs = isEditingOrder ? draftSongs : service.songs;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full mx-auto p-4 sm:p-6 md:p-8 space-y-5 select-none"
    >
      {/* Drag-Down Pull-to-Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{
            height: `${Math.max(pullDistance, isRefreshing ? 44 : 0)}px`,
          }}
          className="flex items-center justify-center overflow-hidden transition-all duration-150 -mt-2"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/60 px-3.5 py-1.5 rounded-full border border-border shadow-xs">
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
                ? "Syncing service..."
                : pullDistance >= PULL_THRESHOLD
                  ? "Release to reload service"
                  : "Pull down to reload"}
            </span>
          </div>
        </div>
      )}

      {/* Service Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
              <CalendarDays className="size-4 lg:size-3.5" />
              {formattedDate}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {service.songs.length} Songs Imported
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate">
            {service.active_plan.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isEditingOrder ? (
              "Drag the grip handle, reorder with arrows, or remove songs, then save to B1.church."
            ) : (
              <>
                Click any song below to open its live chord sheet in{" "}
                <span className="font-medium text-foreground capitalize">
                  {config.notation}
                </span>{" "}
                format.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 self-start sm:self-center shrink-0">
          {!isEditingOrder ? (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={triggerRefresh}
                disabled={isRefreshing}
                className="size-10 lg:size-9 shrink-0"
                title="Reload service plans & songs from B1.church"
              >
                <RefreshCw
                  className={`size-5 lg:size-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddSongModal(true)}
                className="gap-1.5 h-10 lg:h-9"
              >
                <Plus className="size-5 lg:size-4" />
                Add Song
              </Button>
              {service.songs.length > 0 && (
                <Button
                  variant="outline"
                  onClick={startEditingOrder}
                  className="gap-2 h-10 lg:h-9"
                >
                  <ArrowUpDown className="size-5 lg:size-4" />
                  Edit Order
                </Button>
              )}
              <Button
                variant={showServicePicker ? "secondary" : "outline"}
                onClick={() => setShowServicePicker(!showServicePicker)}
                className="gap-2 h-10 lg:h-9"
              >
                <History className="size-5 lg:size-4" />
                {showServicePicker ? "Close Archive" : "Switch Service"}
              </Button>
              {service.songs.length > 0 && (
                <Button
                  onClick={() => onSelectSong(service.songs[0])}
                  className="gap-1.5 h-10 lg:h-9"
                >
                  Start Setlist
                  <ChevronRight className="size-5 lg:size-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAddSongModal(true)}
                disabled={savingOrder}
                className="gap-1.5 h-10 lg:h-9"
              >
                <Plus className="size-4 no-scale" />
                Add Song
              </Button>
              <Button
                variant="outline"
                onClick={cancelEditingOrder}
                disabled={savingOrder}
                className="gap-1.5 h-10 lg:h-9"
              >
                <X className="size-4 no-scale" />
                Cancel
              </Button>
              <Button
                onClick={saveOrderToB1}
                disabled={savingOrder}
                className="gap-1.5 h-10 lg:h-9"
              >
                {savingOrder ? (
                  <Loader2 className="size-4 animate-spin no-scale" />
                ) : (
                  <Save className="size-4 no-scale" />
                )}
                Save Order
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Save Error Banner */}
      {orderError && (
        <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg font-mono">
          {orderError}
        </p>
      )}

      {/* Collapsible Service Archive Drawer */}
      {showServicePicker && !isEditingOrder && (
        <Card className="border-primary/30 bg-muted/30">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Browse Service Plans</CardTitle>
                <CardDescription>
                  Ordered chronologically from most recent to oldest
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by service name or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredPlans.map((plan) => {
                const isActive = plan.id === service.active_plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => {
                      onSelectPlan(plan.id);
                      setShowServicePicker(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-card hover:bg-accent/60"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-mono text-muted-foreground">
                        {plan.service_date
                          ? plan.service_date.slice(0, 10)
                          : "No Date"}
                      </p>
                      <p className="text-sm truncate font-medium mt-0.5">
                        {plan.name}
                      </p>
                    </div>
                    {isActive && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setlist Song Cards Grid */}
      <div
        className={
          isEditingOrder
            ? "flex flex-col gap-2.5 max-w-3xl"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
        }
      >
        {displayedSongs.map((song, idx) => {
          const blocks = splitIntoSectionBlocks(
            song.raw_chordpro,
            config.sectionKeywords
          );
          const sectionHeaders = blocks
            .map((b) => b.header?.replace(/^\[|\]$/g, ""))
            .filter(Boolean)
            .slice(0, 5);

          const displayKey = formatKeySignature(
            song.key_signature,
            accidentalPref
          );

          return (
            <Card
              key={song.plan_item_id}
              data-order-idx={isEditingOrder ? idx : undefined}
              onClick={() => {
                if (!isEditingOrder) onSelectSong(song);
              }}
              className={`group transition-all overflow-hidden ${
                isEditingOrder
                  ? draggedIdx === idx
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-md scale-[1.01]"
                    : "border-border"
                  : "cursor-pointer hover:border-primary/50 hover:shadow-md"
              }`}
            >
              <CardHeader className={isEditingOrder ? "py-3" : "pb-3"}>
                <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
                  {/* Left: Pointer Drag Handle (edit mode) + Number + Title/Artist */}
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    {isEditingOrder && (
                      <div
                        onPointerDown={(e) => handleDragHandlePointerDown(e, idx)}
                        className="p-1.5 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical className="size-5 lg:size-4 no-scale" />
                      </div>
                    )}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-sm font-bold">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors truncate">
                        {song.title}
                      </CardTitle>
                      <CardDescription className="truncate text-xs leading-snug mt-0.5">
                        {song.artist || "Worship Song"}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Right: Reorder/Remove Controls (edit mode) OR Key/BPM Badges */}
                  {isEditingOrder ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={idx === 0 || savingOrder}
                        onClick={() => moveSong(idx, idx - 1)}
                        title="Move up"
                      >
                        <ArrowUp className="size-4 no-scale" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={
                          idx === displayedSongs.length - 1 || savingOrder
                        }
                        onClick={() => moveSong(idx, idx + 1)}
                        title="Move down"
                      >
                        <ArrowDown className="size-4 no-scale" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={savingOrder}
                        onClick={() => removeSongFromOrder(song.plan_item_id)}
                        title="Remove song from service plan"
                      >
                        <Trash2 className="size-4 no-scale" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1 shrink-0">
                      {displayKey ? (
                        <Badge className="font-mono text-xs px-2 py-0.5 shrink-0">
                          Key: {displayKey}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] px-1.5 py-0.5 shrink-0"
                        >
                          NNS
                        </Badge>
                      )}
                      {song.bpm && (
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs px-1.5 py-0.5 gap-1 shrink-0"
                        >
                          <Clock className="size-3 no-scale" />
                          {song.bpm}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              {!isEditingOrder && (
                <CardContent className="pt-0 flex items-center justify-between gap-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
                    {sectionHeaders.length > 0 ? (
                      sectionHeaders.map((sec, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium truncate max-w-full"
                        >
                          {sec}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Music className="size-3.5" /> Ready to view
                      </span>
                    )}
                  </div>

                  <ChevronRight className="size-5 lg:size-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform shrink-0" />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Song Modal */}
      {showAddSongModal && (
        <AddSongModal
          activePlanId={service.active_plan.id}
          activePlanName={service.active_plan.name}
          apiKey={config.apiKey}
          accidentalPreference={accidentalPref}
          onClose={() => setShowAddSongModal(false)}
          onSongAdded={async () => {
            setIsEditingOrder(false);
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}