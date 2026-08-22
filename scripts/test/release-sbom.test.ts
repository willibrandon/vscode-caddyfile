import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

interface CycloneDxComponent {
  readonly "bom-ref": string;
  readonly externalReferences: readonly { readonly type: string; readonly url: string }[];
  readonly hashes: readonly { readonly alg: string; readonly content: string }[];
  readonly licenses: readonly Readonly<Record<string, unknown>>[];
  readonly name: string;
  readonly purl: string;
  readonly type: string;
  readonly version: string;
}

interface CycloneDxDocument {
  readonly components: readonly CycloneDxComponent[];
  readonly dependencies: readonly {
    readonly dependsOn: readonly string[];
    readonly ref: string;
  }[];
  readonly metadata: {
    readonly component: Readonly<Record<string, unknown>>;
  };
  readonly serialNumber: string;
}

interface ReleaseSbomModule {
  createCycloneDxForBundle(input: {
    readonly lock: unknown;
    readonly manifest: unknown;
    readonly metafiles: unknown;
    readonly revision: string;
  }): CycloneDxDocument;
}

const moduleUrl = new URL("../release-sbom.mjs", import.meta.url);
const releaseSbom = (await import(moduleUrl.href)) as ReleaseSbomModule;
const revision = "0123456789abcdef0123456789abcdef01234567";
const manifest = {
  author: { name: "Test Author" },
  bugs: { url: "https://example.com/issues" },
  description: "Test extension",
  homepage: "https://example.com/",
  license: "MIT",
  name: "caddyfile",
  publisher: "willibrandon",
  repository: { url: "https://example.com/repository.git" },
  version: "0.1.0",
};

describe("release SBOM generation", () => {
  it("inventories the exact nested package versions present in esbuild output", () => {
    const result = releaseSbom.createCycloneDxForBundle(fixture());
    expect(result.components.map(({ name, version }) => `${name}@${version}`).sort()).toEqual([
      "@scope/tool@3.0.0",
      "direct@1.0.0",
      "nested@1.0.0",
      "nested@2.0.0",
    ]);
    expect(result.components.every(({ hashes }) => hashes[0]?.alg === "SHA-512")).toBe(true);
    expect(result.components.every(({ hashes }) => hashes[0]?.content.length === 128)).toBe(true);
    expect(
      result.components.every(({ externalReferences }) => externalReferences.length === 1),
    ).toBe(true);

    const direct = result.dependencies.find(({ ref }) => ref === "pkg:npm/direct@1.0.0");
    expect(direct?.dependsOn).toEqual(["pkg:npm/nested@2.0.0"]);
    const root = result.dependencies.find(({ ref }) => ref === "pkg:npm/caddyfile@0.1.0");
    expect(root?.dependsOn).toEqual(result.components.map(({ purl }) => purl));
    expect(result.components.find(({ name }) => name === "@scope/tool")?.purl).toBe(
      "pkg:npm/%40scope/tool@3.0.0",
    );
  });

  it("is deterministic, identifies the source revision, and changes across revisions", () => {
    const first = releaseSbom.createCycloneDxForBundle(fixture());
    const second = releaseSbom.createCycloneDxForBundle(fixture());
    const changed = releaseSbom.createCycloneDxForBundle({
      ...fixture(),
      revision: "1123456789abcdef0123456789abcdef01234567",
    });
    expect(second).toEqual(first);
    expect(first.serialNumber).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(changed.serialNumber).not.toBe(first.serialNumber);
    expect(first.metadata.component).toMatchObject({
      "bom-ref": "pkg:npm/caddyfile@0.1.0",
      properties: [{ name: "vscode-caddyfile:source-revision", value: revision }],
      type: "application",
    });
  });

  it("rejects metadata that cannot prove the shipped dependency inventory", () => {
    const missingLockEntry = fixture();
    Reflect.deleteProperty(
      missingLockEntry.lock.packages,
      "node_modules/direct/node_modules/nested",
    );
    expect(() => releaseSbom.createCycloneDxForBundle(missingLockEntry)).toThrow(
      "has no exact lockfile version",
    );

    const invalidIntegrity = fixture();
    invalidIntegrity.lock.packages["node_modules/direct"].integrity = "sha512-invalid";
    expect(() => releaseSbom.createCycloneDxForBundle(invalidIntegrity)).toThrow(
      "has no supported digest",
    );
    expect(() =>
      releaseSbom.createCycloneDxForBundle({ ...fixture(), metafiles: [{ outputs: {} }] }),
    ).toThrow("has no input map");
    expect(() =>
      releaseSbom.createCycloneDxForBundle({ ...fixture(), revision: "not-a-revision" }),
    ).toThrow("full lowercase Git object ID");
  });
});

function fixture() {
  return {
    manifest: { ...manifest },
    revision,
    metafiles: [
      {
        inputs: {
          "packages/client/src/extension.ts": {},
          "node_modules/@scope/tool/index.js": {},
          "node_modules/direct/index.js": {},
          "node_modules/direct/node_modules/nested/index.js": {},
          "node_modules/nested/index.js": {},
        },
      },
    ],
    lock: {
      packages: {
        "node_modules/@scope/tool": packageMetadata("3.0.0", "MIT"),
        "node_modules/direct": packageMetadata("1.0.0", "MIT", { nested: "2.0.0" }),
        "node_modules/direct/node_modules/nested": packageMetadata("2.0.0", "ISC"),
        "node_modules/nested": packageMetadata("1.0.0", "(MIT OR ISC)"),
      },
    },
  };
}

function packageMetadata(
  version: string,
  license: string,
  dependencies: Readonly<Record<string, string>> = {},
) {
  return {
    dependencies,
    integrity: `sha512-${createHash("sha512").update(version).digest("base64")}`,
    license,
    resolved: `https://registry.example/${version}.tgz`,
    version,
  };
}
