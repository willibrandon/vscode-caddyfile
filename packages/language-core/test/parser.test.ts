import { describe, expect, it } from "vitest";
import { analyzeCaddyfile } from "../src/analysis.js";
import { parseCaddyfile } from "../src/parser.js";

describe("Caddyfile parser", () => {
  it("builds global, snippet, route, matcher, site, and directive statements", () => {
    const parsed = parseCaddyfile(`{
  debug
}
(common) {
  encode zstd gzip
}
&(api) {
  respond "api"
}
example.com {
  @assets path /assets/*
  handle @assets {
    file_server
  }
  import common
  invoke api
}
`);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.statements.map(({ kind, name }) => [kind, name])).toEqual(
      expect.arrayContaining([
        ["global-options", "{"],
        ["global-option", "debug"],
        ["snippet", "(common)"],
        ["named-route", "&(api)"],
        ["site", "example.com"],
        ["matcher", "@assets"],
        ["directive", "handle"],
        ["directive", "file_server"],
        ["import", "import"],
        ["directive", "invoke"],
      ]),
    );
    expect(parsed.definitions.map(({ kind, name }) => `${kind}:${name}`)).toEqual([
      "snippet:common",
      "named-route:api",
      "matcher:assets",
    ]);
    expect(parsed.references.map(({ kind, name }) => `${kind}:${name}`)).toEqual([
      "matcher:assets",
      "snippet:common",
      "named-route:api",
    ]);
  });

  it("accepts a single-site Caddyfile without an address", () => {
    const parsed = parseCaddyfile("reverse_proxy localhost:3000\n");
    expect(parsed.statements).toMatchObject([{ kind: "directive", name: "reverse_proxy" }]);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("reports brace recovery and global option placement", () => {
    const parsed = parseCaddyfile("example.com {\n respond ok\n}\n{\n debug\n}\n}\n");
    expect(parsed.diagnostics.map(({ code }) => code)).toEqual([
      "global-options-order",
      "unexpected-close-brace",
    ]);
  });

  it("reports unclosed blocks and missing brace spacing", () => {
    const parsed = parseCaddyfile("example.com{\n respond ok\n");
    expect(parsed.diagnostics.map(({ code }) => code)).toContain("missing-space-before-brace");
  });

  it("reports duplicate and undefined local symbols", () => {
    const parsed = parseCaddyfile("(x) {\n}\n(x) {\n}\n:80 {\n invoke missing\n}\n");
    expect(parsed.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["duplicate-snippet", "undefined-named-route"]),
    );
  });

  it("treats custom modules as hints instead of syntax errors", () => {
    const diagnostics = analyzeCaddyfile(parseCaddyfile(":80 {\n custom_handler\n}\n"));
    expect(diagnostics).toMatchObject([
      {
        code: "unknown-directive",
        severity: "hint",
      },
    ]);
  });

  it("marks known deprecated directives", () => {
    const diagnostics = analyzeCaddyfile(
      parseCaddyfile(":80 {\n basicauth {\n user hash\n }\n}\n"),
    );
    expect(diagnostics.map(({ code }) => code)).toContain("deprecated-item");
  });

  it("supports disabling and promoting unknown-item diagnostics", () => {
    const parsed = parseCaddyfile("{\n custom_global yes\n}\n");
    expect(analyzeCaddyfile(parsed, { unknownItems: "off" })).toEqual([]);
    expect(analyzeCaddyfile(parsed, { unknownItems: "warning" })).toMatchObject([
      { code: "unknown-global-option", severity: "warning" },
    ]);
    expect(analyzeCaddyfile(parsed, { maxProblems: 0 })).toEqual([]);
  });
});
