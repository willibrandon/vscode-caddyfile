import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCaddyfile } from "@caddyfile/language-core";

const root = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(root, "test/fixtures/upstream/caddy");
const manifest = JSON.parse(
  await readFile(resolve(fixtureRoot, "corpus-manifest.json"), "utf8"),
) as CorpusManifest;
const adapterFiles = manifest.files.filter(({ path }) => path.startsWith("adapter/"));

describe("pinned Caddy parser corpus", () => {
  it("vendors all adapter and parser-table inputs with verified provenance", async () => {
    expect(manifest.upstream).toEqual({
      commit: "51db7f0313b98e047345343a939bb2a3bd975602",
      license: "Apache-2.0",
      repository: "https://github.com/caddyserver/caddy.git",
    });
    expect(adapterFiles).toHaveLength(233);
    expect(manifest.files.filter(({ path }) => path.startsWith("source-tests/"))).toHaveLength(3);
    for (const file of manifest.files) {
      const content = await readFile(resolve(fixtureRoot, file.path));
      expect(content.byteLength, file.path).toBe(file.size);
      expect(createHash("sha256").update(content).digest("hex"), file.path).toBe(file.sha256);
    }
  });

  it.each(adapterFiles)("lexes and recovers through $path", async ({ path }) => {
    const fixture = await readFile(resolve(fixtureRoot, path), "utf8");
    const delimiter = /\n----------[ \t]*\r?\n/u.exec(fixture);
    expect(delimiter?.index ?? -1, path).toBeGreaterThan(0);
    const source = fixture.slice(0, (delimiter?.index ?? fixture.length) + 1);
    const expected = fixture.slice(
      (delimiter?.index ?? fixture.length) + (delimiter?.[0].length ?? 0),
    );
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
    if (expected.trimStart().startsWith("{")) {
      expect(
        parsed.diagnostics.filter(({ code }) =>
          [
            "global-options-order",
            "missing-space-before-brace",
            "unclosed-block",
            "unexpected-close-brace",
          ].includes(code),
        ),
        path,
      ).toEqual([]);
    }
  });
});

interface CorpusManifest {
  readonly upstream: {
    readonly commit: string;
    readonly license: string;
    readonly repository: string;
  };
  readonly files: readonly Readonly<{
    readonly path: string;
    readonly sha256: string;
    readonly size: number;
    readonly upstreamPath: string;
  }>[];
}
