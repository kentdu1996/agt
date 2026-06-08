import { describe, it, expect } from "vitest";
import { route, getArchitectureById, isValidArchId } from "../../src/core/architecture-router.js";
import type { Answers } from "../../src/core/types.js";

function ans(p: Partial<Answers>): Answers {
  return { ui: "web", data: "local", users: "single", aiInvolved: false, ...p };
}

describe("architecture-router", () => {
  it("browser-ext when ui=browser-ext", () => {
    expect(route(ans({ ui: "browser-ext" }), "").id).toBe("browser-ext");
  });

  it("web-fullstack when web + multi", () => {
    expect(route(ans({ ui: "web", users: "multi" }), "").id).toBe("web-fullstack");
  });

  it("web-spa when web + single", () => {
    expect(route(ans({ ui: "web", users: "single" }), "").id).toBe("web-spa");
  });

  it("python-ai when cli + aiInvolved", () => {
    expect(route(ans({ ui: "cli", aiInvolved: true }), "").id).toBe("python-ai");
  });

  it("node-cli when cli + !aiInvolved", () => {
    expect(route(ans({ ui: "cli", aiInvolved: false }), "").id).toBe("node-cli");
  });

  it("fallback (generic) when ui=desktop", () => {
    expect(route(ans({ ui: "desktop" }), "").id).toBe("generic");
  });

  it("honors a valid override", () => {
    expect(route(ans({ ui: "web", users: "single" }), "", "python-ai").id).toBe("python-ai");
  });

  it("ignores an invalid override and routes normally", () => {
    expect(route(ans({ ui: "web", users: "multi" }), "", "nonsense").id).toBe("web-fullstack");
  });

  it("every architecture loads with required fields", () => {
    for (const id of ["web-spa", "web-fullstack", "browser-ext", "python-ai", "node-cli", "generic"]) {
      const a = getArchitectureById(id)!;
      expect(a).toBeTruthy();
      expect(a.init_steps.length).toBeGreaterThan(0);
      expect(Array.isArray(a.agents_md_rules)).toBe(true);
      expect(a.test_command !== undefined).toBe(true);
    }
  });

  it("isValidArchId", () => {
    expect(isValidArchId("web-spa")).toBe(true);
    expect(isValidArchId("xxx")).toBe(false);
  });
});
