import { B1ServiceSong } from "../types";

export const NOTES_STORAGE_KEY = "b1_song_notes";
export const LOCAL_KEYS_STORAGE_KEY = "b1_local_song_keys";

export function getSongStorageKey(song: B1ServiceSong): string {
  return String(song.arrangement_id || song.title || song.plan_item_id);
}

export function readLocalMap(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeLocalMapEntry(
  storageKey: string,
  key: string,
  value: string | null
) {
  try {
    const map = readLocalMap(storageKey);
    if (value === null || value.trim() === "") {
      delete map[key];
    } else {
      map[key] = value;
    }
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}