import { AccidentalPreference, NotationMode } from "../../types";
import {
  isChordToken,
  isConfiguredSectionHeader,
  transformChordProToken,
} from "../../utils/music";
import { Badge } from "@/components/ui/badge";

interface Props {
  line: string;
  sectionKeywords: string[];
  notation: NotationMode;
  activeKey: string;
  accidentalPreference: AccidentalPreference;
}

export default function ChordSheetLine({
  line,
  sectionKeywords,
  notation,
  activeKey,
  accidentalPreference,
}: Props) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <div className="h-[0.75em]" />;
  }

  if (isConfiguredSectionHeader(trimmed, sectionKeywords)) {
    const cleanHeader = trimmed.replace(/^\[|\]$/g, "");
    return (
      <div className="mt-[1em] mb-[0.4em]">
        <Badge
          variant="secondary"
          className="font-sans font-semibold uppercase tracking-wider text-[0.75em] px-2.5 py-0.5"
        >
          {cleanHeader}
        </Badge>
      </div>
    );
  }

  const regex = /(?:\[([^\]]+)\])?([^\[]*)/g;
  const wordTokens: { chord: string; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match[0].length === 0) break;
    const rawBracket = match[1] || "";
    const lyricChunk = match[2] || "";

    const isChord = rawBracket ? isChordToken(rawBracket) : false;
    const convertedChord =
      rawBracket && isChord
        ? transformChordProToken(
            rawBracket,
            notation,
            activeKey,
            accidentalPreference
          )
        : "";

    const combinedText =
      rawBracket && !isChord ? `[${rawBracket}] ${lyricChunk}` : lyricChunk;

    const wordParts = combinedText.match(/\S+\s*|\s+/g) || [""];
    wordParts.forEach((part, idx) => {
      wordTokens.push({
        chord: idx === 0 ? convertedChord : "",
        text: part,
      });
    });
  }

  const lineHasAnyChord = wordTokens.some((t) => t.chord !== "");

  return (
    <div className="flex flex-wrap items-end font-mono leading-tight mb-[0.35em] max-w-full wrap-break-word">
      {wordTokens.map((tok, i) => (
        <span key={i} className="inline-flex flex-col whitespace-pre-wrap max-w-full">
          {lineHasAnyChord && (
            <span
              style={{ color: "var(--chord-color)" }}
              className="font-bold min-h-[1.15em] tracking-tight"
            >
              {tok.chord ? `${tok.chord} ` : "\u00A0"}
            </span>
          )}
          <span className="text-foreground/95 wrap-break-word min-h-[1.15em]">
            {tok.text || "\u00A0"}
          </span>
        </span>
      ))}
    </div>
  );
}