import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AccidentalPreference,
  B1ArrangementKey,
  B1LibrarySong,
  B1SongArrangementOption,
} from "../../types";
import { formatKeySignature } from "../../utils/music";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { X, Search, Loader2, Music, Plus, ChevronLeft } from "lucide-react";

interface Props {
  activePlanId: string;
  activePlanName: string;
  apiKey: string;
  accidentalPreference: AccidentalPreference;
  onClose: () => void;
  onSongAdded: () => Promise<void>;
}

export default function AddSongModal({
  activePlanId,
  activePlanName,
  apiKey,
  accidentalPreference,
  onClose,
  onSongAdded,
}: Props) {
  const [library, setLibrary] = useState<B1LibrarySong[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedSong, setSelectedSong] = useState<B1LibrarySong | null>(null);
  const [options, setOptions] = useState<B1SongArrangementOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoadingLibrary(true);
    setError("");
    invoke<B1LibrarySong[]>("fetch_church_songs", {
      apiToken: apiKey || null,
    })
      .then((list) => {
        if (mounted) setLibrary(list);
      })
      .catch((e) => {
        if (mounted) setError(String(e));
      })
      .finally(() => {
        if (mounted) setLoadingLibrary(false);
      });
    return () => {
      mounted = false;
    };
  }, [apiKey]);

  async function handlePickSong(song: B1LibrarySong) {
    setSelectedSong(song);
    setOptions([]);
    setLoadingOptions(true);
    setError("");
    try {
      const res = await invoke<B1SongArrangementOption[]>(
        "fetch_song_add_options",
        {
          songId: song.id,
          apiToken: apiKey || null,
        }
      );
      setOptions(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleAddWithKey(
    arr: B1SongArrangementOption,
    key: B1ArrangementKey
  ) {
    if (!selectedSong) return;
    setAdding(true);
    setError("");

    const keyLabel =
      key.short_description && key.key_signature
        ? `${key.short_description} (${key.key_signature})`
        : key.short_description || key.key_signature || "Default";

    const prefix = [arr.artist, arr.arrangement_name]
      .filter((s) => s.trim() !== "")
      .join(" - ");
    const description = prefix ? `${prefix} · ${keyLabel}` : keyLabel;

    try {
      await invoke<string>("add_song_to_plan", {
        planId: activePlanId,
        arrangementKeyId: key.id,
        label: selectedSong.name,
        description,
        apiToken: apiKey || null,
      });
      await onSongAdded();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  }

  const filteredSongs = library.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      onClick={() => !adding && onClose()}
    >
      <Card
        className="w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              {selectedSong ? `Select Key: ${selectedSong.name}` : "Add Song to Service"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 truncate">
              {selectedSong
                ? `Choose which arrangement key to add to ${activePlanName}`
                : `Search your B1.church library to add to ${activePlanName}`}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            disabled={adding}
            onClick={onClose}
          >
            <X className="size-4 no-scale" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg font-mono shrink-0">
              {error}
            </p>
          )}

          {!selectedSong ? (
            <>
              <div className="relative shrink-0">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground no-scale" />
                <Input
                  autoFocus
                  placeholder="Search songs in your church library..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 lg:h-9"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {loadingLibrary ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin no-scale" />
                    Loading church song library...
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-10">
                    No songs found matching "{search}".
                  </p>
                ) : (
                  filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => handlePickSong(song)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border bg-background/60 hover:bg-accent text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Music className="size-4 text-primary shrink-0 no-scale" />
                        <span className="text-sm font-medium truncate">
                          {song.name}
                        </span>
                      </div>
                      <Plus className="size-4 text-muted-foreground shrink-0 no-scale" />
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start gap-1 -ml-2 shrink-0"
                disabled={adding}
                onClick={() => {
                  setSelectedSong(null);
                  setError("");
                }}
              >
                <ChevronLeft className="size-4 no-scale" />
                Back to song list
              </Button>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {loadingOptions ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin no-scale" />
                    Loading arrangements &amp; keys...
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    This song has no arrangements configured in B1.church yet.
                  </p>
                ) : (
                  options.map((arr) => (
                    <div
                      key={arr.arrangement_id}
                      className="p-3 rounded-xl border border-border bg-muted/25 space-y-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {arr.arrangement_name || "Default Arrangement"}
                        </p>
                        {arr.artist && (
                          <p className="text-xs text-muted-foreground">
                            {arr.artist}
                          </p>
                        )}
                      </div>

                      {arr.keys.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {arr.keys.map((ak) => {
                            const formattedKey = formatKeySignature(
                              ak.key_signature,
                              accidentalPreference
                            );
                            const label = ak.short_description
                              ? `${ak.short_description} · ${formattedKey || "NNS"}`
                              : formattedKey || "Default";
                            return (
                              <button
                                key={ak.id}
                                type="button"
                                disabled={adding}
                                onClick={() => handleAddWithKey(arr, ak)}
                                className="px-3.5 py-1.5 rounded-full text-sm border border-primary/40 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-colors flex items-center gap-1.5"
                              >
                                {adding ? (
                                  <Loader2 className="size-3.5 animate-spin no-scale" />
                                ) : (
                                  <Plus className="size-3.5 no-scale" />
                                )}
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No keys saved for this arrangement in B1.church.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}