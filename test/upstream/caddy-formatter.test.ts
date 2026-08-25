import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { formatCaddyfile } from "@caddyfile/language-core";

const fixture = JSON.parse(
  await readFile("test/fixtures/upstream/caddy/formatter-cases.json", "utf8"),
) as FormatterFixture;

describe("pinned Caddy formatter conformance", () => {
  it("contains every upstream formatter case at the reviewed revision", () => {
    expect(fixture.upstream).toMatchObject({
      commit: "51db7f0313b98e047345343a939bb2a3bd975602",
      file: "caddyconfig/caddyfile/formatter_test.go",
      license: "Apache-2.0",
    });
    expect(fixture.cases).toHaveLength(30);
    expect(new Set(fixture.cases.map(({ description }) => description)).size).toBe(30);
  });

  it.each(fixture.cases)("$description", ({ input, expect: expected }) => {
    const actual = formatCaddyfile(input);
    expect(actual).toBe(expected);
    expect(formatCaddyfile(actual)).toBe(actual);
  });
});

interface FormatterFixture {
  readonly upstream: {
    readonly commit: string;
    readonly file: string;
    readonly license: string;
  };
  readonly cases: readonly Readonly<{
    readonly description: string;
    readonly input: string;
    readonly expect: string;
  }>[];
}
