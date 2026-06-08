import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the templates directory. In production this file lives at dist/utils/paths.js
 * and templates are copied to dist/templates. In dev (tsx) it resolves to src/templates.
 */
export function templatesDir(): string {
  // dist/utils -> dist/templates
  const distCandidate = join(__dirname, "..", "templates");
  if (existsSync(distCandidate)) return distCandidate;
  // src/utils -> src/templates (dev mode via tsx)
  return join(__dirname, "..", "templates");
}

export function templatePath(...segments: string[]): string {
  return join(templatesDir(), ...segments);
}

/**
 * Resolve the data directory (architectures.json, scene-rules.json, templates, ...).
 * In production it resolves to dist/data; in dev (tsx) to src/data.
 */
export function dataDir(): string {
  // dist/utils -> dist/data, or src/utils -> src/data
  return join(__dirname, "..", "data");
}

export function dataPath(...segments: string[]): string {
  return join(dataDir(), ...segments);
}
