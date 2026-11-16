import { NotationMode } from "../types";

const NASHVILLE_MAP: Record<string, string> = {
  "1": "C", "1#": "C#", "2b": "Db", "2": "D", "2#": "D#", "3b": "Eb",
  "3": "E", "4": "F", "4#": "F#", "5b": "Gb", "5": "G", "5#": "G#",
  "6b": "Ab", "6": "A", "6#": "A#", "7b": "Bb", "7": "B",
};

const ROOT_NOTES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];

const SEMITONES: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Db2": 1, "Eb": 3, "E": 4,
  "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
};

/**
 * Convention: Chords in [] ALWAYS start with a scale degree number (1-7).
 * Anything in [] that does not start with 1-7 (e.g. [Puente - Entra fuerte]) is a section/cue, not a chord.
 */
export function isChordToken(token: string): boolean {
  const trimmed = token.trim().replace(/^\[\vert{}\]$/g, "").trim();
  return /^[1-7][b#]?/.test(trimmed);
}

export function transformChordProToken(token: string, mode: NotationMode, keySignature: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";

  const isNashville = isChordToken(trimmed);
  if (!isNashville) {
    return trimmed;
  }

  if (mode === "nashville") {
    return trimmed;
  }

  if (mode === "chords") {
    const match = trimmed.match(/^([1-7][b#]?)(.*)$/);
    if (!match) return trimmed;
    const [, degree, suffix] = match;
    const baseRoot = NASHVILLE_MAP[degree] || "C";

    if (!keySignature || keySignature.trim() === "") {
      return `${baseRoot}${suffix}`;
    }

    const keyMatch = keySignature.trim().match(/^([A-G][b#]?)/);
    if (!keyMatch) return `${baseRoot}${suffix}`;
    const songKey = keyMatch[1];
    const semitoneOffset = SEMITONES[songKey] || 0;

    const rootMatch = baseRoot.match(/^([A-G][b#]?)/);
    if (!rootMatch) return `${baseRoot}${suffix}`;
    const rootNote = rootMatch[1];
    const rootIdx = SEMITONES[rootNote] || 0;
    const transposedIdx = (rootIdx + semitoneOffset) % 12;
    const newRoot = ROOT_NOTES[(transposedIdx + 12) % 12];

    return `${newRoot}${suffix}`;
  }

  if (mode === "roman") {
    const romanMap: Record<string, { major: string; minor: string }> = {
      "1": { major: "I", minor: "i" },
      "2": { major: "II", minor: "ii" },
      "3": { major: "III", minor: "iii" },
      "4": { major: "IV", minor: "iv" },
      "5": { major: "V", minor: "v" },
      "6": { major: "VI", minor: "vi" },
      "7": { major: "VII", minor: "vii" },
    };

    const match = trimmed.match(/^([1-7][b#]?)(.*)$/);
    if (!match) return trimmed;
    const [, degree, suffix] = match;
    const numKey = degree.charAt(0);
    const isMinor = suffix.toLowerCase().includes("m") && !suffix.toLowerCase().includes("maj");
    const entry = romanMap[numKey];
    if (!entry) return trimmed;
    const romanBase = isMinor ? entry.minor : entry.major;
    const cleanSuffix = suffix.replace(/^m/i, "");
    return `${romanBase}${cleanSuffix}`;
  }

  return trimmed;
}

export function isConfiguredSectionHeader(line: string, sectionKeywords: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const isSingleBracketedLine =
    trimmed.startsWith("[") &&
    trimmed.endsWith("]") &&
    !trimmed.slice(1, -1).includes("[") &&
    !trimmed.slice(1, -1).includes("]");

  const inner = isSingleBracketedLine ? trimmed.slice(1, -1).trim() : trimmed;
  if (!inner) return false;

  // STRICT RULE: If the inner text starts with a number (e.g. 1, 1sus4, 6m), it is a chord, NEVER a section header.
  if (isChordToken(inner)) {
    return false;
  }

  // If the entire line is wrapped in brackets (e.g. [Puente - Entra fuerte]) and does NOT start with a number,
  // always treat it as a section header even if it isn't in sectionKeywords.
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
    const normHeader = (b.header || "").replace(/^\[\vert{}\]$/g, "").trim().toLowerCase();
    const normLines = b.lines.map((l) => l.trim()).join("\n");
    const sig = `${normHeader}::${normLines}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}