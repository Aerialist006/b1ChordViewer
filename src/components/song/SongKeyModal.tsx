import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AccidentalPreference,
  B1ArrangementKey,
  B1ServiceSong,
} from "../../types";
import {
  formatKeySignature,
  getKeyList,
  isMinorKeyString,
  stepKey,
  toggleKeyQuality,
} from "../../utils/music";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { X, Loader2, Save, Minus, Plus } from "lucide-react";

interface Props {
  song: B1ServiceSong;
  activePlanId: string;
  activeKey: string;
  isLocalOverride: boolean;
  apiKey: string;
  accidentalPreference: AccidentalPreference;
  onClose: () => void;
  onApplyLocalKey: (nextKey: string) => void;
  onResetLocalKey: () => void;
  onPlanItemReplaced: (newPlanItemId?: string) => Promise<void>;
}

type ModalMode = "select" | "edit" | "add";

export default function SongKeyModal({
  song,
  activePlanId,
  activeKey,
  isLocalOverride,
  apiKey,
  accidentalPreference,
  onClose,
  onApplyLocalKey,
  onResetLocalKey,
  onPlanItemReplaced,
}: Props) {
  const [keys, setKeys] = useState<B1ArrangementKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [mode, setMode] = useState<ModalMode>("select");

  // Currently selected or edited key pill
  const [selectedKeyId, setSelectedKeyId] = useState<string>(
    song.arrangement_key_id
  );
  const [descDraft, setDescDraft] = useState<string>("");
  const [keyDraft, setKeyDraft] = useState<string>(activeKey || "");
  const [isMinorDraft, setIsMinorDraft] = useState<boolean>(() =>
    isMinorKeyString(activeKey || "")
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoadingKeys(true);
    setError("");
    invoke<B1ArrangementKey[]>("fetch_arrangement_keys", {
      arrangementId: song.arrangement_id,
      apiToken: apiKey || null,
    })
      .then((list) => {
        if (!mounted) return;
        setKeys(list);
        const current = list.find((k) => k.id === song.arrangement_key_id);
        if (current) {
          setSelectedKeyId(current.id);
          setDescDraft(current.short_description);
          setKeyDraft(current.key_signature);
          setIsMinorDraft(isMinorKeyString(current.key_signature));
        }
      })
      .catch((e) => {
        if (mounted) setError(String(e));
      })
      .finally(() => {
        if (mounted) setLoadingKeys(false);
      });
    return () => {
      mounted = false;
    };
  }, [song.arrangement_id, song.arrangement_key_id, apiKey]);

  const displayedKeys = getKeyList(isMinorDraft, accidentalPreference);

  function startEditSelected() {
    const target =
      keys.find((k) => k.id === selectedKeyId) ||
      keys.find((k) => k.id === song.arrangement_key_id);
    if (!target) {
      startAddKey();
      return;
    }
    setSelectedKeyId(target.id);
    setDescDraft(target.short_description);
    setKeyDraft(target.key_signature);
    setIsMinorDraft(isMinorKeyString(target.key_signature));
    setError("");
    setMode("edit");
  }

  function startAddKey() {
    setDescDraft("");
    setKeyDraft(activeKey || "C");
    setIsMinorDraft(isMinorKeyString(activeKey || ""));
    setError("");
    setMode("add");
  }

  function formatPlanKeyLabel(shortDesc: string, keySig: string): string {
    const desc = shortDesc.trim();
    const key = keySig.trim();
    if (desc && key) return `${desc} (${key})`;
    if (desc) return desc;
    if (key) return key;
    return "Default";
  }

  async function handleSelectExistingKeyOnPlan(ak: B1ArrangementKey) {
    if (ak.id === song.arrangement_key_id && !isLocalOverride) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const newPlanItemId = await invoke<string>("replace_plan_item_key", {
        planId: activePlanId,
        planItemId: song.plan_item_id,
        newArrangementKeyId: ak.id,
        newKeyLabel: formatPlanKeyLabel(ak.short_description, ak.key_signature),
        apiToken: apiKey || null,
      });
      await onPlanItemReplaced(newPlanItemId || undefined);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndReimport(targetMode: "edit" | "add") {
    setSaving(true);
    setError("");
    try {
      const finalDesc = descDraft.trim() || keyDraft.trim() || "Default";
      const savedAk = await invoke<B1ArrangementKey>("save_arrangement_key", {
        id: targetMode === "edit" ? selectedKeyId : null,
        arrangementId: song.arrangement_id,
        keySignature: keyDraft,
        shortDescription: finalDesc,
        apiToken: apiKey || null,
      });

      const targetAkId = savedAk.id || selectedKeyId;
      let newPlanItemId = "";
      if (targetAkId) {
        newPlanItemId = await invoke<string>("replace_plan_item_key", {
          planId: activePlanId,
          planItemId: song.plan_item_id,
          newArrangementKeyId: targetAkId,
          newKeyLabel: formatPlanKeyLabel(
            savedAk.short_description || finalDesc,
            savedAk.key_signature || keyDraft
          ),
          apiToken: apiKey || null,
        });
      }

      await onPlanItemReplaced(newPlanItemId || undefined);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={() => !saving && onClose()}
    >
      <Card
        className="w-full max-w-md shadow-xl border-border bg-card max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-lg">Keys</CardTitle>
              <button
                type="button"
                disabled={saving || loadingKeys}
                onClick={startEditSelected}
                className={`text-sm font-medium transition-colors ${
                  mode === "edit"
                    ? "text-primary underline underline-offset-4"
                    : "text-primary/85 hover:text-primary"
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={startAddKey}
                className={`text-sm font-medium transition-colors ${
                  mode === "add"
                    ? "text-primary underline underline-offset-4"
                    : "text-primary/85 hover:text-primary"
                }`}
              >
                Add key
              </button>
            </div>
            <CardDescription className="text-xs mt-1 truncate">
              {song.title}
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

        <CardContent className="space-y-4 overflow-y-auto">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg font-mono">
              {error}
            </p>
          )}

          {/* Named Arrangement Key Pills */}
          <div className="space-y-2">
            {loadingKeys ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="size-4 animate-spin no-scale" />
                Loading saved keys from B1...
              </div>
            ) : keys.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keys.map((ak) => {
                  const isCurrentPlanKey = ak.id === song.arrangement_key_id;
                  const isSelected = ak.id === selectedKeyId;
                  const formattedKey = formatKeySignature(
                    ak.key_signature,
                    accidentalPreference
                  );
                  const label = ak.short_description
                    ? `${ak.short_description} · ${formattedKey || "NNS"}`
                    : formattedKey || "NNS";

                  return (
                    <button
                      key={ak.id}
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setSelectedKeyId(ak.id);
                        setDescDraft(ak.short_description);
                        setKeyDraft(ak.key_signature);
                        setIsMinorDraft(isMinorKeyString(ak.key_signature));
                        if (mode === "select") {
                          handleSelectExistingKeyOnPlan(ak);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-sm transition-all border ${
                        isCurrentPlanKey || (mode === "edit" && isSelected)
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border bg-background hover:bg-accent text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No named keys saved on B1 yet. Click <strong>Add key</strong> to create one.
              </p>
            )}

            {mode === "select" && keys.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tap a key pill to switch this song in the service plan (deletes &amp; reimports with that key), or use the transpose controls below.
              </p>
            )}
          </div>

          {/* Label Input when Adding or Editing a Key */}
          {(mode === "add" || mode === "edit") && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {mode === "add" ? "New Key Name (Singer / Version)" : "Edit Key Name"}
              </label>
              <Input
                placeholder="Default, Arrangement1..."
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                disabled={saving}
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Major / Minor Toggle + Stepper + 12-Key Grid */}
          <div className="space-y-3 pt-1 border-t border-border">
            <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1 gap-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setIsMinorDraft(false);
                  if (keyDraft) {
                    setKeyDraft(
                      toggleKeyQuality(keyDraft, false, accidentalPreference)
                    );
                  }
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  !isMinorDraft
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Major
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setIsMinorDraft(true);
                  if (keyDraft) {
                    setKeyDraft(
                      toggleKeyQuality(keyDraft, true, accidentalPreference)
                    );
                  }
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  isMinorDraft
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Minor
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                disabled={saving}
                onClick={() =>
                  setKeyDraft(
                    stepKey(keyDraft, -1, isMinorDraft, accidentalPreference)
                  )
                }
              >
                <Minus className="size-3.5 no-scale" />
                -1/2
              </Button>
              <span className="font-mono text-base font-bold">
                {keyDraft
                  ? formatKeySignature(keyDraft, accidentalPreference)
                  : "NNS"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                disabled={saving}
                onClick={() =>
                  setKeyDraft(
                    stepKey(keyDraft, 1, isMinorDraft, accidentalPreference)
                  )
                }
              >
                <Plus className="size-3.5 no-scale" />
                +1/2
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {displayedKeys.map((k) => {
                const selected =
                  formatKeySignature(keyDraft, accidentalPreference) === k;
                return (
                  <Button
                    key={k}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="font-mono h-9"
                    disabled={saving}
                    onClick={() => setKeyDraft(k)}
                  >
                    {k}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {mode === "select" ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => onApplyLocalKey(keyDraft)}
                >
                  Apply Locally
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1.5"
                  disabled={saving}
                  onClick={() => handleSaveAndReimport("edit")}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin no-scale" />
                  ) : (
                    <Save className="size-4 no-scale" />
                  )}
                  Update &amp; Reimport
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setMode("select")}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1.5"
                  disabled={saving}
                  onClick={() => handleSaveAndReimport(mode === "add" ? "add" : "edit")}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin no-scale" />
                  ) : (
                    <Save className="size-4 no-scale" />
                  )}
                  {mode === "add" ? "Add & Reimport" : "Save & Reimport"}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setKeyDraft("")}
              >
                Clear (NNS)
              </Button>
              {isLocalOverride && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={onResetLocalKey}
                >
                  Reset to B1 Key
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}