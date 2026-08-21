import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly activationEvents?: readonly string[];
  readonly browser?: string;
  readonly contributes?: Readonly<{
    readonly languages?: readonly Readonly<{ readonly id?: string }>[];
  }>;
  readonly main?: string;
  readonly name?: string;
  readonly publisher?: string;
  readonly version?: string;
}

describe("extension manifest", () => {
  it("uses the intended identity and automatic activation", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    expect(manifest.name).toBe("caddyfile");
    expect(manifest.publisher).toBe("willibrandon");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.activationEvents).toBeUndefined();
    expect(manifest.main).toBe("./dist/extension.cjs");
    expect(manifest.browser).toBe("./dist/browser.js");
    expect(manifest.contributes?.languages?.map(({ id }) => id)).toEqual([
      "caddyfile",
      "caddyfile-test",
    ]);
  });
});
