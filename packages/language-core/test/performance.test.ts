import { describe, expect, it } from "vitest";
import { analyzeCaddyfile } from "../src/analysis.js";
import { formatCaddyfile } from "../src/formatter.js";
import { parseCaddyfile } from "../src/parser.js";

const performanceBudgetMilliseconds = 2_000;

describe("language core performance", () => {
  it("parses, analyzes, and formats a large Caddyfile within the budget", () => {
    const source = Array.from(
      { length: 5_000 },
      (_, index) =>
        `site-${index}.example {\n reverse_proxy 127.0.0.1:${10_000 + (index % 50_000)}\n}\n`,
    ).join("\n");

    const started = performance.now();
    const parsed = parseCaddyfile(source);
    const diagnostics = analyzeCaddyfile(parsed);
    const formatted = formatCaddyfile(source);
    const elapsed = performance.now() - started;

    expect(parsed.statements).toHaveLength(10_000);
    expect(diagnostics).toEqual([]);
    expect(formatted.endsWith("\n")).toBe(true);
    expect(elapsed).toBeLessThan(performanceBudgetMilliseconds);
  });

  it("recovers from a large malformed document within the budget", () => {
    const source = `${"}\n".repeat(25_000)}:80 {\n${"respond {\n".repeat(25_000)}`;

    const started = performance.now();
    const parsed = parseCaddyfile(source);
    const elapsed = performance.now() - started;

    expect(parsed.diagnostics.length).toBeGreaterThan(25_000);
    expect(parsed.statements.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(performanceBudgetMilliseconds);
  });
});
