import { describe, expect, it } from "vitest";
import {
  allKnownNames,
  completionsAt,
  definitionAt,
  hoverAt,
  languageCoverage,
  referencesAt,
  semanticSpans,
} from "../src/intelligence.js";
import { parseCaddyfile } from "../src/parser.js";

describe("language intelligence", () => {
  it("offers directives and filters by the typed prefix", () => {
    const source = ":80 {\n rev\n}\n";
    const completions = completionsAt(parseCaddyfile(source), source.indexOf("rev") + 3);
    expect(completions.map(({ label }) => label)).toEqual(["reverse_proxy"]);
  });

  it("offers global options in the global block", () => {
    const source = "{\n ht\n}\n";
    expect(completionsAt(parseCaddyfile(source), source.indexOf("ht") + 2)).toMatchObject([
      { label: "http_port" },
      { label: "https_port" },
    ]);
  });

  it("offers matcher and parent-specific subdirective completions", () => {
    const matcherSource = ":80 {\n @m ho\n}\n";
    expect(
      completionsAt(parseCaddyfile(matcherSource), matcherSource.indexOf("ho") + 2).map(
        ({ label }) => label,
      ),
    ).toContain("host");

    const proxySource = ":80 {\n reverse_proxy localhost {\n  he\n }\n}\n";
    expect(
      completionsAt(parseCaddyfile(proxySource), proxySource.indexOf("he") + 2).map(
        ({ label }) => label,
      ),
    ).toContain("header_up");
  });

  it("provides behavioral hover documentation and official links", () => {
    const source = ":80 {\n reverse_proxy localhost:3000\n}\n";
    const hover = hoverAt(parseCaddyfile(source), source.indexOf("reverse_proxy") + 2);
    expect(hover?.markdown).toContain("Proxy requests to one or more upstream servers.");
    expect(hover?.markdown).toContain(
      "https://caddyserver.com/docs/caddyfile/directives/reverse_proxy",
    );
  });

  it("includes values and deprecation guidance in hover documentation", () => {
    const source = ":80 {\n basicauth {\n  user hash\n }\n}\n";
    const hover = hoverAt(parseCaddyfile(source), source.indexOf("basicauth") + 2);
    expect(hover?.markdown).toContain("Deprecated:");
    expect(hover?.markdown).toContain("basic_auth");
    expect(hoverAt(parseCaddyfile("# comment\n"), 2)).toBeUndefined();
    expect(hoverAt(parseCaddyfile(""), 0)).toBeUndefined();
  });

  it("describes locally defined symbols", () => {
    const source = "(common) {\n encode gzip\n}\n";
    expect(hoverAt(parseCaddyfile(source), source.indexOf("common") + 2)?.markdown).toContain(
      "snippet defined in this Caddyfile",
    );
  });

  it("finds definitions and references for named routes", () => {
    const source = "&(api) {\n respond ok\n}\n:80 {\n invoke api\n}\n";
    const parsed = parseCaddyfile(source);
    const referenceOffset = source.lastIndexOf("api");
    expect(definitionAt(parsed, referenceOffset)?.name).toBe("api");
    expect(referencesAt(parsed, referenceOffset)).toHaveLength(2);
  });

  it("does not treat file imports or unrelated text as local symbols", () => {
    const source = ":80 {\n import ./parts.caddy\n respond ok\n}\n";
    const parsed = parseCaddyfile(source);
    const importOffset = source.indexOf("./parts.caddy") + 2;
    expect(definitionAt(parsed, importOffset)).toBeUndefined();
    expect(referencesAt(parsed, importOffset)).toEqual([]);
    expect(referencesAt(parsed, source.indexOf("respond"))).toEqual([]);
  });

  it("produces semantic spans for comments, variables, values, and names", () => {
    const source = ":{$PORT} {\n # hello\n respond {env.HOME} 200\n}\n";
    const types = semanticSpans(parseCaddyfile(source)).map(({ type }) => type);
    expect(types).toEqual(expect.arrayContaining(["comment", "variable", "number", "keyword"]));
  });

  it("scans adversarial environment placeholders in linear time", () => {
    const repeated = "{$A:".repeat(100_000);
    const started = performance.now();
    const spans = semanticSpans(parseCaddyfile(`:80 {\nrespond ${repeated}\n}\n`));
    expect(spans.filter(({ type }) => type === "variable")).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("covers the complete standard top-level registry", () => {
    expect(languageCoverage()).toEqual({
      directives: 43,
      globalOptions: 40,
      matchers: 16,
      subdirectives: 22,
    });
  });

  it("exposes every contextual registry name", () => {
    const names = allKnownNames();
    expect(names).toContain("reverse_proxy");
    expect(names).toContain("http_port");
    expect(names).toHaveLength(121);
    expect(new Set(names).size).toBeLessThan(names.length);
  });
});
