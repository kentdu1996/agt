// Copies non-TS static assets into dist so they ship with the package and are
// resolvable at runtime relative to the compiled JS in dist/.
//   src/templates -> dist/templates
//   src/data      -> dist/data   (architectures.json, scene-rules.json, templates/, ...)
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function copyDir(rel) {
  const src = join(root, "src", rel);
  const dest = join(root, "dist", rel);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`Copied ${rel} -> dist/${rel}`);
  } else {
    console.warn(`No src/${rel} directory found, skipping copy.`);
  }
}

copyDir("templates");
copyDir("data");
