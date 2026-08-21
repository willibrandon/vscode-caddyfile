import { describe, expect, it } from "vitest";
import { CADDY_LANGUAGE_DATA_VERSION } from "../src/index.js";

describe("language data", () => {
  it("identifies the bundled Caddy baseline", () => {
    expect(CADDY_LANGUAGE_DATA_VERSION).toBe("2.11.4");
  });
});
