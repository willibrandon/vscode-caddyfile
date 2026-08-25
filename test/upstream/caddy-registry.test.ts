import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { directives, globalOptions } from "@caddyfile/language-core";

const fixture = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../fixtures/upstream/caddy/registry.json"), "utf8"),
) as RegistryFixture;

describe("pinned Caddy registry", () => {
  it("covers every directive compiled into standard Caddy", () => {
    expect(fixture.upstream).toEqual({
      commit: "51db7f0313b98e047345343a939bb2a3bd975602",
      license: "Apache-2.0",
      repository: "https://github.com/caddyserver/caddy.git",
    });
    expect(
      directives
        .map(({ name }) => name)
        .filter((name) => name !== "import")
        .sort(),
    ).toEqual(fixture.directives);
  });

  it("covers every global option compiled into standard Caddy", () => {
    expect(globalOptions.map(({ name }) => name).sort()).toEqual(fixture.globalOptions);
    expect(fixture.sourceFiles).toContain("caddyconfig/httpcaddyfile/options.go");
    expect(fixture.sourceFiles).toContain("modules/caddyevents/eventsconfig/caddyfile.go");
  });
});

interface RegistryFixture {
  readonly upstream: {
    readonly commit: string;
    readonly license: string;
    readonly repository: string;
  };
  readonly directives: readonly string[];
  readonly globalOptions: readonly string[];
  readonly sourceFiles: readonly string[];
}
