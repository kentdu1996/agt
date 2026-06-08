import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("loads i18n", async () => {
    const { t } = await import("../src/i18n/index.js");
    expect(typeof t.cli.description).toBe("string");
  });
});
