import { describe, expect, it } from "vitest";
import { caddyResultSummary, parseCaddyOutput } from "../src/caddy-output.js";

describe("Caddy output diagnostics", () => {
  it("maps Caddy stdin locations to zero-based document positions", () => {
    expect(
      parseCaddyOutput(
        "",
        "Error: adapting config using caddyfile: parsing caddyfile tokens for 'respond': -:6:4 - Error during parsing: wrong argument count",
        10,
      ),
    ).toEqual([
      {
        character: 3,
        line: 5,
        message:
          "Error: adapting config using caddyfile: parsing caddyfile tokens for 'respond': -:6:4 - Error during parsing: wrong argument count",
        severity: "error",
      },
    ]);
  });

  it("clamps reported lines and recognizes warnings", () => {
    expect(parseCaddyOutput("", "Caddyfile:999: warning: unused option", 3)).toMatchObject([
      { character: 0, line: 2, severity: "warning" },
    ]);
  });

  it("parses the structured error emitted by current Caddy", () => {
    const line =
      '{"level":"error","ts":1787352636.8928392,"msg":"parsing caddyfile tokens for \'respond\': wrong argument count or unexpected line ending after \'four\', at -:2"}';
    expect(parseCaddyOutput("", line, 4)).toEqual([
      {
        character: 0,
        line: 1,
        message:
          "parsing caddyfile tokens for 'respond': wrong argument count or unexpected line ending after 'four', at -:2",
        severity: "error",
      },
    ]);
  });

  it("caps messages and produces bounded summaries", () => {
    expect(parseCaddyOutput("", "one\ntwo\nthree", 1)).toHaveLength(3);
    expect(
      caddyResultSummary({
        exitCode: null,
        stderr: "",
        stdout: "",
        timedOut: true,
        truncated: false,
      }),
    ).toBe("Caddy timed out after 10 seconds.");
    expect(
      caddyResultSummary({
        exitCode: null,
        stderr: "",
        stdout: "",
        timedOut: false,
        truncated: true,
      }),
    ).toBe("Caddy exceeded the 256 KiB output limit.");
    expect(
      caddyResultSummary({
        exitCode: 7,
        stderr: "",
        stdout: "",
        timedOut: false,
        truncated: false,
      }),
    ).toBe("Caddy exited with code 7.");
  });
});
