import schemesData from "@/data/schemes.json";

export interface Scheme {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  eligibility: string;
  link: string;
}

export const SCHEMES: Scheme[] = schemesData;
const MAX_MATCHES = 3;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * English keywords match whole words only ("id" must not match "accident").
 * Hindi/Punjabi keywords match as substrings, since \b does not work for those scripts.
 */
function keywordMatches(question: string, keyword: string): boolean {
  if (/^[\x00-\x7F]+$/.test(keyword)) {
    return new RegExp(`\\b${escapeRegex(keyword)}(s|es)?\\b`, "i").test(question);
  }
  return question.includes(keyword);
}

/** Server-side retrieval: pick the most relevant schemes by keyword overlap (English, Hindi, Punjabi). */
export function selectSchemes(question: string, schemes: Scheme[] = SCHEMES): Scheme[] {
  const q = question.toLowerCase();
  return schemes
    .map((s) => ({ s, score: s.keywords.filter((k) => keywordMatches(q, k.toLowerCase())).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
    .map((x) => x.s);
}

/**
 * The model must end with a line "SOURCES: id1,id2" (or "SOURCES: none").
 * Returns the cleaned answer only if every cited id was among the records we sent.
 */
export function verifyCitations(
  answer: string,
  allowed: Scheme[],
): { ok: boolean; text: string; cited: Scheme[] } {
  const match = answer.match(/SOURCES:\s*([^\n]*)\s*$/i);
  if (!match) return { ok: false, text: "", cited: [] };
  const ids = match[1]
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id && id !== "none");
  const allowedIds = new Set(allowed.map((s) => s.id));
  if (ids.length === 0 || !ids.every((id) => allowedIds.has(id))) {
    return { ok: false, text: "", cited: [] };
  }
  const text = answer.slice(0, match.index).trim();
  return { ok: true, text, cited: allowed.filter((s) => ids.includes(s.id)) };
}
