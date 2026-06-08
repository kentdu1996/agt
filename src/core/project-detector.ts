import fs from "fs-extra";
import path from "node:path";

export type ProjectType = "node" | "python" | "go" | "rust" | "generic";

export interface DetectedProject {
  type: ProjectType;
  testCommand: string;
  buildCommand: string;
  lintCommand: string;
  techStack: string;
}

async function readJson(file: string): Promise<any | null> {
  try {
    return await fs.readJson(file);
  } catch {
    return null;
  }
}

export async function detectProject(dir: string): Promise<DetectedProject> {
  const has = async (f: string) => fs.pathExists(path.join(dir, f));

  if (await has("package.json")) {
    const pkg = (await readJson(path.join(dir, "package.json"))) || {};
    const scripts = pkg.scripts || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const stackBits: string[] = ["Node.js"];
    if (deps.typescript || (await has("tsconfig.json"))) stackBits.push("TypeScript");
    if (deps.react) stackBits.push("React");
    if (deps.vue) stackBits.push("Vue");
    if (deps.next) stackBits.push("Next.js");
    if (deps.express || deps.fastify || deps.koa) stackBits.push("Node API");
    return {
      type: "node",
      testCommand: scripts.test ? "npm test" : "",
      buildCommand: scripts.build ? "npm run build" : "",
      lintCommand: scripts.lint ? "npm run lint" : "",
      techStack: stackBits.join(" + "),
    };
  }

  if ((await has("pyproject.toml")) || (await has("requirements.txt")) || (await has("setup.py"))) {
    return {
      type: "python",
      testCommand: "pytest",
      buildCommand: "python -m build",
      lintCommand: "ruff check .",
      techStack: "Python",
    };
  }

  if (await has("go.mod")) {
    return {
      type: "go",
      testCommand: "go test ./...",
      buildCommand: "go build ./...",
      lintCommand: "go vet ./...",
      techStack: "Go",
    };
  }

  if (await has("Cargo.toml")) {
    return {
      type: "rust",
      testCommand: "cargo test",
      buildCommand: "cargo build",
      lintCommand: "cargo clippy",
      techStack: "Rust",
    };
  }

  return {
    type: "generic",
    testCommand: "",
    buildCommand: "",
    lintCommand: "",
    techStack: "Unknown",
  };
}
