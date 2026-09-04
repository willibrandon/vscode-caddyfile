import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly activationEvents?: readonly string[];
  readonly browser?: string;
  readonly contributes?: Readonly<{
    readonly configuration?: Readonly<{
      readonly properties?: Readonly<
        Record<string, Readonly<{ readonly default?: unknown; readonly type?: string }>>
      >;
    }>;
    readonly configurationDefaults?: Readonly<Record<string, unknown>>;
    readonly languages?: readonly Readonly<{
      readonly extensions?: readonly string[];
      readonly filenamePatterns?: readonly string[];
      readonly filenames?: readonly string[];
      readonly id?: string;
    }>[];
    readonly views?: unknown;
    readonly viewsContainers?: unknown;
  }>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly extensionDependencies?: readonly string[];
  readonly extensionPack?: readonly string[];
  readonly main?: string;
  readonly name?: string;
  readonly packageManager?: string;
  readonly publisher?: string;
  readonly version?: string;
}

describe("extension manifest", () => {
  it("uses the intended identity and automatic activation", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    expect(manifest.name).toBe("caddyfile");
    expect(manifest.publisher).toBe("willibrandon");
    expect(manifest.version).toBe("0.2.2");
    expect(manifest.activationEvents).toBeUndefined();
    expect(manifest.main).toBe("./dist/extension.cjs");
    expect(manifest.browser).toBe("./dist/browser.js");
    expect(manifest.contributes?.languages?.map(({ id }) => id)).toEqual([
      "caddyfile",
      "caddyfile-test",
    ]);
    expect(manifest.extensionDependencies).toBeUndefined();
    expect(manifest.extensionPack).toBeUndefined();
  });

  it("has a dated changelog entry for the packaged version", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    const changelog = await readFile("CHANGELOG.md", "utf8");
    const version = (manifest.version ?? "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    expect(changelog).toMatch(new RegExp(`^## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}$`, "mu"));
  });

  it("recognizes the intended files without claiming other configuration languages", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    expect(manifest.contributes?.languages?.[0]).toMatchObject({
      extensions: [".caddyfile", ".Caddyfile"],
      filenamePatterns: ["Caddyfile.*", "Caddyfile-*"],
      filenames: ["Caddyfile"],
      id: "caddyfile",
    });
    expect(manifest.contributes?.languages?.[1]).toMatchObject({
      extensions: [".caddyfiletest"],
      id: "caddyfile-test",
    });
    expect(JSON.stringify(manifest.contributes?.languages)).not.toMatch(/Corefile|Wedgefile/u);
  });

  it("keeps optional execution off and leaves standard VS Code UI behavior alone", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    const properties = manifest.contributes?.configuration?.properties;
    expect(properties?.["caddyfile.caddy.command"]).toMatchObject({
      default: ["caddy"],
      type: "array",
    });
    expect(properties?.["caddyfile.caddy.checkOnSave"]).toMatchObject({
      default: false,
      type: "boolean",
    });
    expect(properties?.["caddyfile.index.useIgnoreFiles"]).toMatchObject({
      default: true,
      type: "boolean",
    });
    expect(manifest.contributes?.configurationDefaults).toBeUndefined();
    expect(manifest.contributes?.views).toBeUndefined();
    expect(manifest.contributes?.viewsContainers).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain("editor.formatOnSave");
  });

  it("uses the current supported build toolchain without Turbo or pnpm", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
    expect(manifest.packageManager).toBe("npm@12.0.2");
    expect(manifest.devDependencies?.["esbuild"]).toBe("0.28.2");
    expect(manifest.devDependencies?.["turbo"]).toBeUndefined();
  });
});
