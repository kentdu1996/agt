import { pinyin } from "pinyin-pro";
import stopWordsData from "../data/stop-words.json" with { type: "json" };
import conceptDictData from "../data/concept-dict.json" with { type: "json" };

const STOP_WORDS: string[] = stopWordsData as string[];
const CONCEPT_DICT: Record<string, string> = conceptDictData as Record<string, string>;

const CJK = /[\u3400-\u9fff]/;
const MAX_SEGMENTS = 6;
const MAX_LENGTH = 40;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Turn an arbitrary token into safe kebab pieces (lowercase, [a-z0-9-]). */
function toKebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate an English kebab-case project slug from a natural-language idea.
 * 100% deterministic, no network / no LLM. Falls back to `project-<random>`.
 *
 * Algorithm:
 *  1. lowercase
 *  2. replace concept-dictionary hits (longest key first, whitespace-tolerant for CJK)
 *  3. strip stop words
 *  4. split into segments; pass-through ASCII, pinyin-convert leftover CJK
 *  5. dedupe adjacent, cap segments/length, fallback if empty
 */
export function generateSlug(idea: string, customName?: string): string {
  if (customName && customName.trim()) {
    const direct = toKebab(customName);
    return direct || `project-${randomSuffix()}`;
  }

  let s = (idea || "").toLowerCase();

  // 2. Concept replacement, longest keys first to avoid partial shadowing.
  const orderedKeys = Object.keys(CONCEPT_DICT).sort((a, b) => b.length - a.length);
  for (const key of orderedKeys) {
    const slug = CONCEPT_DICT[key];
    let re: RegExp;
    if (CJK.test(key)) {
      // Allow optional whitespace between each character (handles "B 站").
      const pattern = key.split("").map(escapeRegExp).join("\\s*");
      re = new RegExp(pattern, "g");
    } else {
      re = new RegExp(`\\b${escapeRegExp(key)}\\b`, "g");
    }
    s = s.replace(re, ` ${slug} `);
  }

  // 3. Strip stop words.
  for (const stop of STOP_WORDS) {
    const lower = stop.toLowerCase();
    const re = CJK.test(lower)
      ? new RegExp(escapeRegExp(lower), "g")
      : new RegExp(`\\b${escapeRegExp(lower)}\\b`, "gi");
    s = s.replace(re, " ");
  }

  // 4. Segment on whitespace + punctuation; convert each segment.
  const rawSegments = s.split(/[\s,.，。、；;:：!！?？/\\|()（）【】\[\]{}"'`~@#$%^&*+=<>]+/);
  const tokens: string[] = [];
  let pinyinCount = 0;
  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    if (CJK.test(trimmed)) {
      // Leftover Chinese -> pinyin (max 3 pinyin words total).
      const py = pinyin(trimmed, { toneType: "none", type: "array" }) as string[];
      for (const word of py) {
        if (pinyinCount >= 3) break;
        const k = toKebab(word);
        if (k) {
          tokens.push(k);
          pinyinCount++;
        }
      }
    } else {
      const k = toKebab(trimmed);
      if (k) tokens.push(k);
    }
  }

  // Flatten any tokens that themselves contain hyphens, dedupe adjacent dups.
  const flat: string[] = [];
  for (const tok of tokens) {
    for (const piece of tok.split("-")) {
      if (!piece) continue;
      if (flat[flat.length - 1] !== piece) flat.push(piece);
    }
  }

  // 5. Cap segments + length.
  let chosen = flat.slice(0, MAX_SEGMENTS);
  let slug = chosen.join("-");
  while (slug.length > MAX_LENGTH && chosen.length > 1) {
    chosen = chosen.slice(0, -1);
    slug = chosen.join("-");
  }
  if (slug.length > MAX_LENGTH) slug = slug.slice(0, MAX_LENGTH).replace(/-+$/g, "");

  if (!slug) slug = `project-${randomSuffix()}`;
  return slug;
}
