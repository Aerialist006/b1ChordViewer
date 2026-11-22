export type NotationMode = "nashville" | "chords" | "roman";
export type LayoutMode = "full" | "columns" | "blocks";
export type AccidentalPreference = "auto" | "flats" | "sharps";

export type PastelColorId =
  | "lavender"
  | "matcha"
  | "peach"
  | "sky"
  | "rose"
  | "butter"
  | "mint"
  | "periwinkle";

export interface PastelPreset {
  id: PastelColorId;
  swatch: string;
  lightHex: string;
  fgOnDark: string;
}

export const PASTEL_PRESETS: PastelPreset[] = [
  { id: "lavender",   swatch: "#c4b5fd", lightHex: "#7c3aed", fgOnDark: "#1e1b4b" },
  { id: "matcha",     swatch: "#86efac", lightHex: "#15803d", fgOnDark: "#052e16" },
  { id: "peach",      swatch: "#fdba74", lightHex: "#c2410c", fgOnDark: "#431407" },
  { id: "sky",        swatch: "#7dd3fc", lightHex: "#0369a1", fgOnDark: "#082f49" },
  { id: "rose",       swatch: "#f9a8d4", lightHex: "#be185d", fgOnDark: "#500724" },
  { id: "butter",     swatch: "#fde047", lightHex: "#a16207", fgOnDark: "#422006" },
  { id: "mint",       swatch: "#5eead4", lightHex: "#0f766e", fgOnDark: "#042f2e" },
  { id: "periwinkle", swatch: "#a5b4fc", lightHex: "#4338ca", fgOnDark: "#1e1b4b" },
];

export interface UserConfig {
  apiKey: string;
  notation: NotationMode;
  accidentalPreference: AccidentalPreference;
  layout: LayoutMode;
  columnCount: number;
  sectionKeywords: string[];
  darkMode: boolean;
  zoom: number;
  accentColor: PastelColorId;
  chordColor: PastelColorId;
}

export interface B1PlanSummary {
  id: string;
  name: string;
  service_date: string | null;
}

export interface B1ArrangementKey {
  id: string;
  arrangement_id: string;
  key_signature: string;
  short_description: string;
}

export interface B1ServiceSong {
  plan_item_id: string;
  arrangement_key_id: string;
  arrangement_id: string;
  title: string;
  artist: string;
  key_signature: string;
  bpm: number | null;
  raw_chordpro: string;
}

export interface B1ServicePayload {
  active_plan: B1PlanSummary;
  all_plans: B1PlanSummary[];
  songs: B1ServiceSong[];
}

export interface B1LibrarySong {
  id: string;
  name: string;
}

export interface B1SongArrangementOption {
  arrangement_id: string;
  arrangement_name: string;
  artist: string;
  keys: B1ArrangementKey[];
}

export interface ParsedBlock {
  header: string | null;
  lines: string[];
}