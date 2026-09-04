import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCaddyfile } from "@caddyfile/language-core";

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/upstream/tree-sitter-caddyfile");
const manifest = JSON.parse(
  await readFile(resolve(fixtureRoot, "corpus-manifest.json"), "utf8"),
) as CorpusManifest;
const structuralCodes = new Set([
  "global-options-order",
  "missing-space-before-brace",
  "unclosed-block",
  "unexpected-close-brace",
]);
const cases = (
  await Promise.all(
    manifest.files.map(async (file) => {
      const content = await readFile(resolve(fixtureRoot, file.path), "utf8");
      return parseCorpus(content).map((testCase) => ({ ...file, ...testCase }));
    }),
  )
).flat();

describe("pinned tree-sitter Caddyfile corpus", () => {
  it("vendors the full corpus and pull request 64 regressions with verified provenance", async () => {
    expect(manifest.upstream).toEqual({
      commit: "90e0a0c6e82ccc59fc2320a3ad71b4edb93c15f3",
      license: "MIT",
      repository: "https://github.com/caddyserver/tree-sitter-caddyfile.git",
    });
    expect(manifest.pullRequests["64"]).toEqual({
      commit: "9d3af6ae44ea5f9015bc2c9a5a02066c192ab627",
      files: ["named_matchers.txt", "sites.txt"],
      url: "https://github.com/caddyserver/tree-sitter-caddyfile/pull/64",
    });
    expect(manifest.files.filter(({ sourceKind }) => sourceKind === "base")).toHaveLength(14);
    expect(manifest.files.filter(({ sourceKind }) => sourceKind === "pull-64")).toHaveLength(2);
    for (const file of manifest.files) {
      const content = await readFile(resolve(fixtureRoot, file.path));
      expect(content.byteLength, file.path).toBe(file.size);
      expect(createHash("sha256").update(content).digest("hex"), file.path).toBe(file.sha256);
    }
  });

  it("includes the reported regex and multiline-site regressions", () => {
    const titles = cases
      .filter(({ sourceKind }) => sourceKind === "pull-64")
      .map(({ title }) => title);
    expect(titles).toContain("path_regexp with Regex does not break subsequent parsing");
    expect(titles).toContain("Site Block with multiline comma-separated addresses");
  });

  it.each(cases)("parses $sourceKind/$title from $path", ({ expected, path, source }) => {
    const parsed = parseCaddyfile(source);
    expect(parsed.tokens.length, path).toBeGreaterThan(0);
    expect(parsed.statements.length, path).toBeGreaterThan(0);
    expect(
      parsed.tokens.every(
        ({ span }) => span.start >= 0 && span.start <= span.end && span.end <= source.length,
      ),
      path,
    ).toBe(true);
    expect(
      parsed.tokens.every(
        (token, index, tokens) =>
          index === 0 || (tokens[index - 1]?.span.end ?? 0) <= token.span.start,
      ),
      path,
    ).toBe(true);
    if (!expected.includes("(ERROR")) {
      expect(
        parsed.diagnostics.filter(({ code }) => structuralCodes.has(code)),
        path,
      ).toEqual([]);
    }
  });
});

function parseCorpus(content: string): readonly CorpusCase[] {
  const normalized = content.replaceAll("\r\n", "\n");
  const pattern =
    /^={3,}\n(?<title>[\s\S]*?)\n={3,}\n(?<source>[\s\S]*?)\n---\n(?<expected>[\s\S]*?)(?=^={3,}\n|$)/gmu;
  return [...normalized.matchAll(pattern)].map(({ groups }) => ({
    expected: groups?.["expected"]?.trim() ?? "",
    source: (groups?.["source"] ?? "").trimEnd() + "\n",
    title: groups?.["title"]?.trim() ?? "unnamed",
  }));
}

interface CorpusCase {
  readonly expected: string;
  readonly source: string;
  readonly title: string;
}

interface CorpusManifest {
  readonly upstream: {
    readonly commit: string;
    readonly license: string;
    readonly repository: string;
  };
  readonly pullRequests: Readonly<
    Record<
      string,
      Readonly<{
        readonly commit: string;
        readonly files: readonly string[];
        readonly url: string;
      }>
    >
  >;
  readonly files: readonly Readonly<{
    readonly path: string;
    readonly ref: string;
    readonly sha256: string;
    readonly size: number;
    readonly sourceKind: "base" | "pull-64";
    readonly upstreamPath: string;
  }>[];
}
