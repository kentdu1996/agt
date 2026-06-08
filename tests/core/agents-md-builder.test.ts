import { describe, it, expect } from "vitest";
import { build, previewSections, matchSceneRules } from "../../src/core/agents-md-builder.js";
import { getArchitectureById } from "../../src/core/architecture-router.js";
import type { TemplateContext } from "../../src/core/types.js";

function ctxFor(idea: string, archId: string): TemplateContext {
  const architecture = getArchitectureById(archId)!;
  return {
    idea,
    slug: "test-project",
    date: "2026-06-08",
    user: { name: "Tester" },
    architecture,
    answers: { ui: "web", data: "local", users: "single", aiInvolved: false },
  };
}

describe("agents-md-builder", () => {
  it("builds web-spa AGENTS.md with stack + scene rules", () => {
    const md = build(ctxFor("B 站浏览记录知识管理", "web-spa"));
    expect(md).toContain("Vite 6");
    expect(md).toContain("Tailwind v4");
    expect(md).toContain("Redux"); // arch rule mentions never use Redux
    expect(md).toContain("social media platform API URLs"); // bilibili scene rule
    expect(md).not.toContain("{{");
  });

  it("fallback architecture stays short and valid", () => {
    const md = build(ctxFor("something weird", "generic"));
    expect(md).not.toContain("{{");
    expect(md.split("\n").length).toBeLessThan(120);
  });

  it("matchSceneRules finds bilibili rules", () => {
    expect(matchSceneRules("B站视频").length).toBeGreaterThan(0);
    expect(matchSceneRules("a plain idea").length).toBe(0);
  });

  it("shows no-scene placeholder when nothing matches", () => {
    const sections = previewSections(ctxFor("a plain idea", "node-cli"));
    expect(sections.sceneNever).toContain("No scene-specific constraints");
  });

  it("caps total lines under 250 even with many scene hits", () => {
    const md = build(
      ctxFor("B站微博知乎抖音 爬虫 微信支付 登录 AI GPT 上传文件", "web-fullstack"),
    );
    expect(md.split("\n").length).toBeLessThanOrEqual(250);
  });

  it("numbers architecture rules starting at 14", () => {
    const sections = previewSections(ctxFor("plain", "web-spa"));
    expect(sections.archNever.startsWith("14.")).toBe(true);
  });
});
