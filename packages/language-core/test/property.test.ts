import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatCaddyfile } from "../src/formatter.js";
import { parseCaddyfile } from "../src/parser.js";
import type { TextSpan } from "../src/types.js";

const argument = fc.stringMatching(/^[A-Za-z0-9_.:/-]{1,24}$/u);
const horizontalSpace = fc.constantFrom(" ", "  ", "\t", " \t");
const lineBreak = fc.constantFrom("\n", "\r\n", "\n\n");
const directive = fc
  .tuple(
    fc.constantFrom("respond", "reverse_proxy", "redir", "encode", "file_server"),
    fc.array(argument, { maxLength: 3 }),
    horizontalSpace,
  )
  .map(
    ([name, arguments_, space]) =>
      `${name}${arguments_.length === 0 ? "" : space}${arguments_.join(space)}`,
  );

describe("language core properties", () => {
  it("formats generated Caddyfiles idempotently without changing statement names", () => {
    fc.assert(
      fc.property(
        argument,
        fc.array(directive, { maxLength: 12, minLength: 1 }),
        horizontalSpace,
        lineBreak,
        (host, directives, space, newline) => {
          const source = `${host}.test${space}{${newline}${directives
            .map((item) => `${space}${item}`)
            .join(newline)}${newline}}`;
          const formatted = formatCaddyfile(source);
          expect(formatCaddyfile(formatted)).toBe(formatted);
          expect(formatted.endsWith("\n")).toBe(true);
          expect(parseCaddyfile(formatted).statements.map(({ name }) => name)).toEqual(
            parseCaddyfile(source).statements.map(({ name }) => name),
          );
        },
      ),
      { numRuns: 250 },
    );
  });

  it("recovers from arbitrary Unicode with spans contained in the source", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2_000 }), (source) => {
        const parsed = parseCaddyfile(source);
        const spans = [
          ...parsed.tokens.flatMap(({ span, start, end }) => [
            span,
            { end: start.offset, start: start.offset },
            { end: end.offset, start: end.offset },
          ]),
          ...parsed.statements.flatMap(({ span, nameSpan }) => [span, nameSpan]),
          ...parsed.diagnostics.map(({ span }) => span),
          ...parsed.definitions.map(({ span }) => span),
          ...parsed.references.map(({ span }) => span),
        ];
        for (const span of spans) expect(validSpan(span, source.length)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

function validSpan(span: TextSpan, length: number): boolean {
  return span.start >= 0 && span.start <= span.end && span.end <= length;
}
