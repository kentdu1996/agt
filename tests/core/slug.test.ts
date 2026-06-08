import { describe, it, expect } from "vitest";
import { generateSlug } from "../../src/core/slug.js";

describe("generateSlug", () => {
  it.each([
    ["我想做一个 B 站浏览记录知识管理工具", "bilibili-history-kb-manager"],
    ["番茄钟", "pomodoro"],
    ["用 GPT 整理我的笔记", "gpt-notes"],
    ["Build a todo app", "todo-app"],
    ["做个聊天机器人，要支持微信和支付宝", "chatbot-wechat-alipay"],
  ])("%s -> %s", (idea, expected) => {
    expect(generateSlug(idea)).toBe(expected);
  });

  it("falls back to project-XXXXXX for empty input", () => {
    expect(generateSlug("")).toMatch(/^project-[a-z0-9]{6}$/);
  });

  it("respects a custom name override (kebab-cased)", () => {
    expect(generateSlug("anything", "My Cool App")).toBe("my-cool-app");
  });

  it("produces only kebab-safe characters", () => {
    const slug = generateSlug("一个超级复杂的!!!中文@@@想法###测试");
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("caps length at 40 chars", () => {
    const slug = generateSlug("supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopic");
    expect(slug.length).toBeLessThanOrEqual(40);
  });
});
