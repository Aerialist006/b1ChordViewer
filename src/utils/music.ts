import { AccidentalPreference, NotationMode } from "../types";

const MAJOR_SEMITONES: Record<string, number> = {
  "1": 0, "1#": 1, "2b": 1, "2": 2, "2#": 3, "3b": 3,
  "3": 4, "4": 5, "4#": 6, "5b": 6, "5": 7, "5#": 8,
  "6b": 8, "6": 9, "6#": 10, "7b": 10, "7": 11,
};

const MINOR_SEMITONES: Record<string, number> = {
  "1": 0, "1#": 1, "2b": 1, "2": 2, "2#": 3, "3b": 3,
  "3": 3, "3#": 4, "4": 5, "4#": 6, "5b": 6, "5": 7,
  "5#": 8, "6b": 8, "6": 8, "6#": 9, "7b": 10, "7": 10, "7#": 11,
};

export const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NOTES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const KEY_TO_SEMITONE: Record<string, number> = {
  "C": 0, "B#": 0,
  "C#": 1, "Db": 1,
  "D": 2,
  "D#": 3, "Eb": 3,
  "E": 4, "Fb": 4,
  "F": 5, "E#": 5,
  "F#": 6, "Gb": 6,
  "G": 7,
  "G#": 8, "Ab": 8,
  "A": 9,
  "A#": 10, "Bb": 10,
  "B": 11, "Cb": 11,
};

const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm",
]);

export function isMinorKeyString(key: string): boolean {
  return key.trim().endsWith("m");
}

export function getKeyList(
  isMinor: boolean,
  accidentalPref: AccidentalPreference = "auto"
): string[] {
  const roots =
    accidentalPref === "sharps"
      ? SHARP_NOTES
      : accidentalPref === "flats"
        ? FLAT_NOTES
        : isMinor
          ? ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
          : FLAT_NOTES;
  return isMinor ? roots.map((r) => `${r}m`) : roots;
}

export function stepKey(
  currentKey: string,
  delta: number,
  isMinorMode: boolean,
  accidentalPref: AccidentalPreference = "auto"
): string {
  const list = getKeyList(isMinorMode, accidentalPref);
  const trimmed = currentKey.trim();
  if (!trimmed) return delta >= 0 ? list[0] : list[11];
  const match = trimmed.match(/^([A-G][b#]?)(m?)$/);
  if (!match) return list[0];
  const idx = KEY_TO_SEMITONE[match[1]] ?? 0;
  return list[(idx + delta + 12) % 12];
}

export function toggleKeyQuality(
  currentKey: string,
  toMinor: boolean,
  accidentalPref: AccidentalPreference = "auto"
): string {
  const trimmed = currentKey.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^([A-G][b#]?)(m?)$/);
  if (!match) return "";
  const idx = KEY_TO_SEMITONE[match[1]] ?? 0;
  return getKeyList(toMinor, accidentalPref)[idx];
}

export function formatKeySignature(
  keySignature: string,
  accidentalPref: AccidentalPreference = "auto"
): string {
  const trimmed = keySignature.trim();
  if (!trimmed || accidentalPref === "auto") return trimmed;
  const match = trimmed.match(/^([A-G][b#]?)(m?)$/);
  if (!match) return trimmed;
  const idx = KEY_TO_SEMITONE[match[1]];
  if (idx === undefined) return trimmed;
  const scale = accidentalPref === "flats" ? FLAT_NOTES : SHARP_NOTES;
  return `${scale[idx]}${match[2]}`;
}

export function getQuickChordsForKey(keySignature: string): string[] {
  if (isMinorKeyString(keySignature)) {
    return [
      "[1m]", "[2dis]", "[3]", "[4m]", "[5m]", "[5]",
      "[6]", "[7]", "[7dis]", "[1msus4]", "[5/7]",
    ];
  }
  return [
    "[1]", "[2m]", "[3m]", "[4]", "[5]", "[6m]",
    "[7dis]", "[1sus4]", "[4/6]", "[5/7]",
  ];
}

function degreeToNote(
  degree: string,
  keySignature: string,
  accidentalPref: AccidentalPreference = "auto"
): string {
  const trimmedKey = keySignature.trim();
  const keyMatch = trimmedKey.match(/^([A-G][b#]?)(m?)$/);
  const keyRoot = keyMatch ? keyMatch[1] : "C";
  const isMinorKey = keyMatch ? keyMatch[2] === "m" : false;

  const semitoneMap = isMinorKey ? MINOR_SEMITONES : MAJOR_SEMITONES;
  const degreeOffset = semitoneMap[degree];
  if (degreeOffset === undefined) return degree;

  const keySemitone = KEY_TO_SEMITONE[keyRoot] ?? 0;

  let useFlats: boolean;
  if (accidentalPref === "flats") {
    useFlats = true;
  } else if (accidentalPref === "sharps") {
    useFlats = false;
  } else {
    useFlats =
      FLAT_KEYS.has(trimmedKey) ||
      (!isMinorKey && FLAT_KEYS.has(keyRoot)) ||
      degree.endsWith("b");
  }

  const scale = useFlats ? FLAT_NOTES : SHARP_NOTES;
  return scale[(keySemitone + degreeOffset) % 12];
}

function degreeToRoman(degree: string, isLower: boolean): string {
  const romanMap: Record<string, { major: string; minor: string }> = {
    "1": { major: "I", minor: "i" },
    "2": { major: "II", minor: "ii" },
    "3": { major: "III", minor: "iii" },
    "4": { major: "IV", minor: "iv" },
    "5": { major: "V", minor: "v" },
    "6": { major: "VI", minor: "vi" },
    "7": { major: "VII", minor: "vii" },
  };
  const numKey = degree.charAt(0);
  const accidental = degree.slice(1);
  const entry = romanMap[numKey];
  if (!entry) return degree;
  return `${accidental}${isLower ? entry.minor : entry.major}`;
}

export function isChordToken(token: string): boolean {
  const trimmed = token.trim().replace(/^\[|\]$/g, "").trim();
  return /^[1-7][b#]?/.test(trimmed);
}

export function transformChordProToken(
  token: string,
  mode: NotationMode,
  keySignature: string,
  accidentalPref: AccidentalPreference = "auto"
): string {
  const trimmed = token.trim();
  if (!trimmed) return "";

  if (!isChordToken(trimmed)) {
    return trimmed;
  }

  if (mode === "nashville") {
    return trimmed;
  }

  const [mainPart, bassPart] = trimmed.split("/");

  if (mode === "chords") {
    const match = mainPart.match(/^([1-7][b#]?)(.*)$/);
    if (!match) return trimmed;
    const [, degree, suffix] = match;
    const keyToUse = keySignature && keySignature.trim() !== "" ? keySignature : "C";
    const newRoot = degreeToNote(degree, keyToUse, accidentalPref);

    if (bassPart && /^[1-7][b#]?$/.test(bassPart.trim())) {
      const newBass = degreeToNote(bassPart.trim(), keyToUse, accidentalPref);
      return `${newRoot}${suffix}/${newBass}`;
    }
    return `${newRoot}${suffix}`;
  }

  if (mode === "roman") {
    const match = mainPart.match(/^([1-7][b#]?)(.*)$/);
    if (!match) return trimmed;
    const [, degree, suffix] = match;
    const isDim = /^(dis|dim|°)/i.test(suffix);
    const isMinor =
      !isDim &&
      (/^m(?!aj)/i.test(suffix) ||
        (suffix.toLowerCase().includes("m") && !suffix.toLowerCase().includes("maj")));

    const romanBase = degreeToRoman(degree, isMinor || isDim);
    const cleanSuffix = isMinor ? suffix.replace(/^m(?!aj)/i, "") : suffix;

    if (bassPart && /^[1-7][b#]?$/.test(bassPart.trim())) {
      const romanBass = degreeToRoman(bassPart.trim(), false);
      return `${romanBase}${cleanSuffix}/${romanBass}`;
    }
    return `${romanBase}${cleanSuffix}`;
  }

  return trimmed;
}

export function isConfiguredSectionHeader(
  line: string,
  sectionKeywords: string[]
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const isSingleBracketedLine =
    trimmed.startsWith("[") &&
    trimmed.endsWith("]") &&
    !trimmed.slice(1, -1).includes("[") &&
    !trimmed.slice(1, -1).includes("]");

  const inner = isSingleBracketedLine ? trimmed.slice(1, -1).trim() : trimmed;
  if (!inner) return false;

  if (isChordToken(inner)) {
    return false;
  }

  if (isSingleBracketedLine) {
    return true;
  }

  const innerLower = inner.toLowerCase();

  for (const kw of sectionKeywords) {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) continue;
    if (innerLower === cleanKw) return true;
    if (innerLower.startsWith(cleanKw)) {
      const rest = innerLower.slice(cleanKw.length).trim();
      if (!rest || /^[\d:\-\s()]+/.test(rest)) {
        return true;
      }
    }
  }

  return false;
}

export interface ParsedBlock {
  header: string | null;
  lines: string[];
}

export function splitIntoSectionBlocks(
  chordpro: string,
  sectionKeywords: string[],
  deduplicate = false
): ParsedBlock[] {
  const lines = chordpro.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock = { header: null, lines: [] };

  const pushCleanedBlock = (blk: ParsedBlock) => {
    let start = 0;
    while (start < blk.lines.length && blk.lines[start].trim() === "") start++;
    let end = blk.lines.length - 1;
    while (end >= start && blk.lines[end].trim() === "") end--;

    const cleanedLines = blk.lines.slice(start, end + 1);
    if (blk.header !== null || cleanedLines.length > 0) {
      blocks.push({ header: blk.header, lines: cleanedLines });
    }
  };

  for (const line of lines) {
    if (isConfiguredSectionHeader(line, sectionKeywords)) {
      pushCleanedBlock(current);
      current = { header: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  pushCleanedBlock(current);

  if (!deduplicate) return blocks;

  const seen = new Set<string>();
  return blocks.filter((b) => {
    const normLines = b.lines
      .map((l) => l.trim().replace(/\s+/g, " ").toLowerCase())
      .filter(Boolean)
      .join("\n");
    if (!normLines) return true;
    if (seen.has(normLines)) return false;
    seen.add(normLines);
    return true;
  });
}