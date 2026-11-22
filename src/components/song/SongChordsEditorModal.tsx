import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AccidentalPreference, B1ServiceSong } from "../../types";
import {
  formatKeySignature,
  getQuickChordsForKey,
  isMinorKeyString,
  transformChordProToken,
} from "../../utils/music";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { X, Save, Loader2 } from "lucide-react";

interface Props {
  song: B1ServiceSong;
  activeKey: string;
  apiKey: string;
  accidentalPreference: AccidentalPreference;
  onClose: () => void;
  onSaved: (newLyrics: string) => void;
}

export default function SongChordsEditorModal({
  song,
  activeKey,
  apiKey,
  accidentalPreference,
  onClose,
  onSaved,
}: Props) {
  const [lyricsDraft, setLyricsDraft] = useState(song.raw_chordpro);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const quickChords = getQuickChordsForKey(activeKey);
  const isMinor = isMinorKeyString(activeKey);
  const hasKey = Boolean(activeKey && activeKey.trim() !== "");

  function insertChordAtCursor(chordStr: string) {
    const el = textareaRef.current;
    if (!el) {
      setLyricsDraft((prev) => `${prev}${chordStr}`);
      return;
    }
    const start = el.selectionStart ?? lyricsDraft.length;
    const end = el.selectionEnd ?? lyricsDraft.length;
    const updated =
      lyricsDraft.slice(0, start) + chordStr + lyricsDraft.slice(end);
    setLyricsDraft(updated);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + chordStr.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = await invoke<string>("update_song_lyrics", {
        arrangementId: song.arrangement_id,
        newLyrics: lyricsDraft,
        apiToken: apiKey || null,
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      onClick={() => !saving && onClose()}
    >
      <Card
        className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              Edit Chords: {song.title}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {hasKey
                ? `Suggestions tuned for ${formatKeySignature(activeKey, accidentalPreference)} (${isMinor ? "Minor" : "Major"}).`
                : "Use Nashville numbers in brackets (e.g. [1], [4], [5], [7dis])."}{" "}
              Changes save directly to B1.church.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            disabled={saving}
            onClick={onClose}
          >
            <X className="size-4 no-scale" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 min-h-0 pt-2">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg font-mono shrink-0">
              {error}
            </p>
          )}

          {/* Dynamic Major/Minor Quick-Insert Chord Chips (including [7dis]) */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {quickChords.map((ch) => {
              const inner = ch.slice(1, -1);
              const transposed = hasKey
                ? transformChordProToken(
                    inner,
                    "chords",
                    activeKey,
                    accidentalPreference
                  )
                : null;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => insertChordAtCursor(ch)}
                  className="px-2 py-1 rounded-md border border-border bg-muted/50 hover:bg-accent text-xs font-mono font-semibold text-foreground transition-colors flex items-center gap-1.5"
                >
                  <span>{ch}</span>
                  {transposed && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {transposed}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={lyricsDraft}
            onChange={(e) => setLyricsDraft(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-65 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs sm:text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin no-scale" />
              ) : (
                <Save className="size-4 no-scale" />
              )}
              Save to B1
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}