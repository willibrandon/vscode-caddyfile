import { describe, expect, it } from "vitest";
import { splitCaddyfileTest } from "../src/caddyfile-test.js";

describe("Caddyfile adapter test documents", () => {
  it("separates the Caddyfile from the JSON without changing either section", () => {
    const source = ':80 {\r\n  respond "ok"\r\n}\r\n----------  \r\n{"apps":{}}\r\n';
    expect(splitCaddyfileTest(source)).toEqual({
      caddyfile: ':80 {\r\n  respond "ok"\r\n}\r\n',
      delimiterOffset: 26,
      remainder: '----------  \r\n{"apps":{}}\r\n',
    });
  });

  it("treats a document without an exact separator as Caddyfile text", () => {
    const source = ":80 {\n\trespond ok\n}\n---------\n";
    expect(splitCaddyfileTest(source)).toEqual({
      caddyfile: source,
      delimiterOffset: source.length,
      remainder: "",
    });
  });
});
