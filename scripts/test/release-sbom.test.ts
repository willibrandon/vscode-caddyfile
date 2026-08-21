import { describe, expect, it } from "vitest";

interface CycloneDxDocument {
  readonly components?: readonly Readonly<Record<string, unknown>>[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly serialNumber: string;
}

interface ReleaseSbomModule {
  prepareCycloneDxForAttestation(value: unknown, seed: string): CycloneDxDocument;
}

const moduleUrl = new URL("../release-sbom.mjs", import.meta.url);
const releaseSbom = (await import(moduleUrl.href)) as ReleaseSbomModule;

describe("release SBOM preparation", () => {
  it("creates deterministic RFC 4122 serial numbers and removes timestamps", () => {
    const input = {
      bomFormat: "CycloneDX",
      metadata: { timestamp: "2026-08-12T00:00:00.000Z", tools: [{ name: "npm" }] },
      specVersion: "1.6",
      version: 1,
    };
    const first = releaseSbom.prepareCycloneDxForAttestation(input, "same-seed");
    const second = releaseSbom.prepareCycloneDxForAttestation(input, "same-seed");
    const different = releaseSbom.prepareCycloneDxForAttestation(input, "different-seed");
    expect(first.metadata).toEqual({});
    expect(first.serialNumber).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(second.serialNumber).toBe(first.serialNumber);
    expect(different.serialNumber).not.toBe(first.serialNumber);
  });

  it("normalizes npm component names and rejects non-CycloneDX input", () => {
    const component = {
      "bom-ref": "@caddyfile/language-core@0.1.0",
      name: "language-core",
      purl: "pkg:npm/%40caddyfile/language-core@0.1.0",
      type: "library",
      version: "0.1.0",
    };
    const result = releaseSbom.prepareCycloneDxForAttestation(
      { bomFormat: "CycloneDX", components: [component], specVersion: "1.6", version: 1 },
      "seed",
    );
    expect(result.components?.[0]).toMatchObject({ name: "@caddyfile/language-core" });
    expect(() => releaseSbom.prepareCycloneDxForAttestation({}, "seed")).toThrow(
      "The generated SBOM is not a CycloneDX JSON document.",
    );
  });
});
