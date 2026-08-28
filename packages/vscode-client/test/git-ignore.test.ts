import { describe, expect, it } from "vitest";
import { GitIgnoreRules } from "../src/git-ignore.js";

describe("workspace Git ignore rules", () => {
  it("excludes root artifact directories without matching path prefixes", () => {
    const rules = new GitIgnoreRules([{ contents: "artifacts/\n", directory: "" }]);

    expect(rules.ignores("artifacts/Caddyfile.generated")).toBe(true);
    expect(rules.ignores("artifacts", true)).toBe(true);
    expect(rules.ignores("artifacts-copy/Caddyfile")).toBe(false);
  });

  it("lets a nested ignore file override a file rule inherited from the root", () => {
    const rules = new GitIgnoreRules([
      { contents: "*.caddyfile\n", directory: "" },
      { contents: "!keep.caddyfile\n", directory: "sites" },
    ]);

    expect(rules.ignores("other.caddyfile")).toBe(true);
    expect(rules.ignores("sites/other.caddyfile")).toBe(true);
    expect(rules.ignores("sites/keep.caddyfile")).toBe(false);
  });

  it("does not read a nested ignore file below an excluded parent", () => {
    const rules = new GitIgnoreRules([
      { contents: "artifacts/\n", directory: "" },
      { contents: "!Caddyfile\n", directory: "artifacts" },
    ]);

    expect(rules.ignores("artifacts/Caddyfile")).toBe(true);
  });

  it("supports anchored patterns, comments, escapes, and Windows separators", () => {
    const rules = new GitIgnoreRules([
      {
        contents: "/Caddyfile.generated\n# comment\n\\#generated.caddyfile\n",
        directory: "",
      },
    ]);

    expect(rules.ignores("Caddyfile.generated")).toBe(true);
    expect(rules.ignores("nested/Caddyfile.generated")).toBe(false);
    expect(rules.ignores("#generated.caddyfile")).toBe(true);
    expect(rules.ignores("nested\\site.caddyfile")).toBe(false);
  });
});
