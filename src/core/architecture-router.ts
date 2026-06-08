import architecturesData from "../data/architectures.json" with { type: "json" };
import type { Answers, ArchId, ArchitectureDef } from "./types.js";

interface ArchitecturesFile {
  version: string;
  updated: string;
  architectures: ArchitectureDef[];
  fallback: ArchitectureDef;
}

const DATA = architecturesData as unknown as ArchitecturesFile;

const VALID_IDS: ArchId[] = [
  "web-spa",
  "web-fullstack",
  "browser-ext",
  "python-ai",
  "node-cli",
  "generic",
];

export function getArchitectureById(id: string): ArchitectureDef | null {
  if (id === "generic" || id === "fallback") return DATA.fallback;
  return DATA.architectures.find((a) => a.id === id) ?? null;
}

export function listArchitectures(): ArchitectureDef[] {
  return DATA.architectures;
}

export function isValidArchId(id: string): id is ArchId {
  return VALID_IDS.includes(id as ArchId) || id === "fallback";
}

/**
 * Route questionnaire answers to one of the built-in architectures.
 * Priority:
 *   1. explicit override
 *   2. browser-ext
 *   3. web + multi  -> web-fullstack
 *   4. web + single -> web-spa
 *   5. cli + ai     -> python-ai
 *   6. cli + !ai    -> node-cli
 *   7. desktop / anything else -> fallback (generic)
 */
export function route(answers: Answers, _idea: string, override?: string): ArchitectureDef {
  if (override && isValidArchId(override)) {
    const arch = getArchitectureById(override);
    if (arch) return arch;
  }

  switch (answers.ui) {
    case "browser-ext":
      return getArchitectureById("browser-ext")!;
    case "web":
      return answers.users === "multi"
        ? getArchitectureById("web-fullstack")!
        : getArchitectureById("web-spa")!;
    case "cli":
      return answers.aiInvolved
        ? getArchitectureById("python-ai")!
        : getArchitectureById("node-cli")!;
    case "desktop":
    default:
      return DATA.fallback;
  }
}
