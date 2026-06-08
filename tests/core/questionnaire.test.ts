import { describe, it, expect } from "vitest";
import { infer, ask } from "../../src/core/questionnaire.js";

describe("questionnaire.infer", () => {
  it("detects browser extension", () => {
    expect(infer("Chrome 网页摘要插件").ui).toBe("browser-ext");
  });

  it("detects web app", () => {
    const a = infer("一个番茄钟网页");
    expect(a.ui).toBe("web");
  });

  it("detects cli + ai for GPT data scripts", () => {
    const a = infer("用 GPT 批量处理 Excel 数据的命令行脚本");
    expect(a.ui).toBe("cli");
    expect(a.aiInvolved).toBe(true);
  });

  it("detects multi-user db apps", () => {
    const a = infer("团队任务协作 SaaS 平台，需要登录");
    expect(a.users).toBe("multi");
    expect(a.data).toBe("db");
  });

  it("ai idea without explicit ui defaults to cli", () => {
    expect(infer("用 Claude 总结文章").ui).toBe("cli");
  });

  it("routes the 5 documented validation ideas correctly", async () => {
    const { route } = await import("../../src/core/architecture-router.js");
    const cases: Array<[string, string]> = [
      ["B 站浏览记录知识管理工具", "web-spa"],
      ["团队任务协作 SaaS 平台", "web-fullstack"],
      ["Chrome 网页摘要插件", "browser-ext"],
      ["用 GPT 批量处理 Excel 数据", "python-ai"],
      ["Git 提交信息生成器", "node-cli"],
    ];
    for (const [idea, expected] of cases) {
      expect(route(infer(idea), idea).id, idea).toBe(expected);
    }
  });
});

describe("questionnaire.ask (--yes uses inference)", () => {
  it("returns inferred answers without prompting when yes=true", async () => {
    const a = await ask("Chrome 划词翻译插件", { yes: true });
    expect(a.ui).toBe("browser-ext");
  });

  it("returns inferred answers when archOverride set", async () => {
    const a = await ask("anything", { archOverride: "web-spa" });
    expect(a).toHaveProperty("ui");
  });
});
