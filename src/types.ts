export type NotationMode = "nashville" | "chords" | "roman";
export type LayoutMode = "full" | "columns" | "blocks";

export interface UserConfig {
  notation: NotationMode;
  layout: LayoutMode;
  columnCount: number;
  sectionKeywords: string[];
  darkMode: boolean; // Toggles .dark class on <html>
  zoom: number;      // Font size in px (default: 16)
}

export interface B1PlanSummary {
  id: string;
  name: string;
  service_date: string | null;
}

export interface B1ServiceSong {
  plan_item_id: string;
  arrangement_key_id: string;
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

export interface ParsedBlock {
  header: string | null;
  lines: string[];
}