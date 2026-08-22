import { describe, expect, it } from "vitest";
import { formatCaddyfile } from "../src/formatter.js";

const cases: readonly Readonly<{ input: string; output: string }>[] = [
  { input: "abc   def\n\tg hi jkl\nmn", output: "abc def\ng hi jkl\nmn\n" },
  { input: "a{\n b\n}\n\nc{ d\n}", output: "a {\n\tb\n}\n\nc {\n\td\n}\n" },
  { input: ":{$PORT}", output: ":{$PORT}\n" },
  { input: "foo {bar}", output: "foo {bar}\n" },
  { input: "foo{bar} foo{bar}baz", output: "foo{bar} foo{bar}baz\n" },
  { input: "redir / /some/#/path", output: "redir / /some/#/path\n" },
  {
    input: "{\n email {$ACMEEMAIL}\n #debug\n }\n\n block {\n }\n",
    output: "{\n\temail {$ACMEEMAIL}\n\t#debug\n}\n\nblock {\n}\n",
  },
  {
    input: 'block { respond "`" } block { respond `"`}',
    output: 'block {\n\trespond "`"\n}\n\nblock {\n\trespond `"`\n}\n',
  },
  {
    input: 'block {\n respond "{"\n respond "}"\n}',
    output: 'block {\n\trespond "{"\n\trespond "}"\n}\n',
  },
  {
    input: "block {\n heredoc <<END\n\tspaces   stay\nEND\n respond ok     200\n}",
    output: "block {\n\theredoc <<END\n\tspaces   stay\nEND\n\trespond ok 200\n}\n",
  },
  {
    input: "import ./one.caddy\nimport ./two.caddy\n{\n debug\n}",
    output: "import ./one.caddy\nimport ./two.caddy\n{\n\tdebug\n}\n",
  },
];

describe("Caddy-compatible formatter", () => {
  it.each(cases)("formats an upstream behavior case", ({ input, output }) => {
    expect(formatCaddyfile(input)).toBe(output);
  });

  it.each(cases)("is idempotent", ({ output }) => {
    expect(formatCaddyfile(formatCaddyfile(output))).toBe(output);
  });

  it("always returns a final newline", () => {
    expect(formatCaddyfile("   ")).toBe("\n");
  });
});
