import { NotationMode, ParsedBlock } from "../types";

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

const SEMITONE_TO_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SEMITONE_TO_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

const DEGREE_TO_SEMITONES: Record<string, number> = {
  "1": 0,
  b2: 1, "#1": 1,
  "2": 2,
  b3: 3, "#2": 3,
  "3": 4,
  "4": 5,
  b5: 6, "#4": 6,
  "5": 7,
  b6: 8, "#5": 8,
  "6": 9,
  b7: 10, "#6": 10,
  "7": 11,
};

const DEGREE_TO_ROMAN: Record<string, string> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "7": "VII",
};

const SINGLE_NASHVILLE_RE = /^([b#]?[1-7])(maj|min|dim|aug|sus|add|m|M|2|4|5|6|7|9|11|13|[#b+\-°()])*$/;

interface KeyInfo {
  semi: number;
  isMinor: boolean;
  useFlats: boolean;
}

function getReferenceKeyInfo(keySignature: string): KeyInfo | null {
  const trimmed = keySignature.trim();
  if (!trimmed) return null;

  const m = trimmed.match(/^([A-G][#b]?)(m?)$/);
  if (!m) return null;

  const root = m[1];
  const isMinor = m[2] === "m";
  const semi = NOTE_TO_SEMITONE[root];
  if (semi === undefined) return null;

  return {
    semi, // Always use the root note directly as 1 (e.g. Am -> A is 1)
    isMinor,
    useFlats: FLAT_KEYS.has(trimmed),
  };
}

function convertSingleToken(
  token: string,
  targetMode: NotationMode,
  keyInfo: KeyInfo | null,
  isBassNote = false
): string {
  if (token.includes("/")) {
    const [left, right] = token.split("/", 2);
    const convLeft = convertSingleToken(left, targetMode, keyInfo, false);
    const convRight = convertSingleToken(right, targetMode, keyInfo, true);
    return `${convLeft}/${convRight}`;
  }

  const match = token.trim().match(/^([b#]?[1-7])(.*)$/);
  if (!match || !SINGLE_NASHVILLE_RE.test(token.trim())) {
    return token;
  }

  const degreeStr = match[1];
  let suffix = match[2] || "";

  // If the tone in B1 is minor (e.g. "Am") and degree is "1" without an explicit minor/major suffix, treat 1 as minor ("1m" -> "Am")
  if (
    !isBassNote &&
    keyInfo?.isMinor &&
    degreeStr === "1" &&
    !suffix.startsWith("m") &&
    !suffix.startsWith("M") &&
    !suffix.startsWith("dim") &&
    !suffix.startsWith("aug") &&
    !suffix.startsWith("sus")
  ) {
    suffix = `m${suffix}`;
  }

  if (targetMode === "nashville" || (targetMode === "chords" && !keyInfo)) {
    return token;
  }

  if (targetMode === "chords" && keyInfo) {
    const offset = DEGREE_TO_SEMITONES[degreeStr];
    if (offset === undefined) return token;
    const noteIndex = (keyInfo.semi + offset) % 12;
    const noteName = keyInfo.useFlats ? SEMITONE_TO_FLAT[noteIndex] : SEMITONE_TO_SHARP[noteIndex];
    return `${noteName}${suffix}`;
  }

  if (targetMode === "roman") {
    const accidental = degreeStr.startsWith("b") || degreeStr.startsWith("#") ? degreeStr[0] : "";
    const numDigit = accidental ? degreeStr.slice(1) : degreeStr;
    let roman = DEGREE_TO_ROMAN[numDigit] || numDigit;

    const isMinorChord = suffix.startsWith("m") && !suffix.startsWith("maj");
    if (isMinorChord) {
      roman = roman.toLowerCase();
      return `${accidental}${roman}${suffix.slice(1)}`;
    }
    return `${accidental}${roman}${suffix}`;
  }

  return token;
}

export function transformChordProToken(
  bracketContent: string,
  targetMode: NotationMode,
  keySignature: string
): string {
  const keyInfo = getReferenceKeyInfo(keySignature);
  return convertSingleToken(bracketContent, targetMode, keyInfo, false);
}

export function isConfiguredSectionHeader(line: string, sectionKeywords: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const inner =
    trimmed.startsWith("[") && trimmed.endsWith("]") && !trimmed.slice(1, -1).includes("[")
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return sectionKeywords.some((kw) => {
    const cleanKw = kw.trim();
    if (!cleanKw) return false;
    const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}(\\s+\\d+|\\s*[:\\-])?$`, "i");
    return re.test(inner);
  });
}

export function splitIntoSectionBlocks(chordpro: string, sectionKeywords: string[]): ParsedBlock[] {
  const lines = chordpro.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock = { header: null, lines: [] };

  const pushCleanedBlock = (blk: ParsedBlock) => {
    // Trim leading and trailing empty lines so all cards align evenly
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
  return blocks;
}