import { describe, expect, it } from "vitest";
import { tokenize } from "../src/lexer.js";

describe("Caddyfile lexer", () => {
  it("recognizes comments only at token boundaries", () => {
    const result = tokenize("redir / /some/#/path # comment\n");
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map(({ kind, value }) => [kind, value])).toEqual([
      ["word", "redir"],
      ["word", "/"],
      ["word", "/some/#/path"],
      ["comment", " comment"],
      ["newline", "\n"],
    ]);
  });

  it("keeps escaped quotes and multiline quoted values", () => {
    const result = tokenize('respond "one \\"two\\"\nthree"\n');
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[1]).toMatchObject({ kind: "quoted", value: 'one "two"\nthree' });
    expect(result.tokens[1]?.start).toMatchObject({ character: 8, line: 0 });
    expect(result.tokens[1]?.end.line).toBe(1);
  });

  it("reports unterminated strings without discarding their token", () => {
    const result = tokenize('respond "unfinished');
    expect(result.tokens.at(-1)?.kind).toBe("quoted");
    expect(result.diagnostics).toMatchObject([{ code: "unterminated-string", severity: "error" }]);
  });

  it("recognizes heredocs and their exact source range", () => {
    const source = "respond <<BODY\nhello {world}\nBODY\n";
    const result = tokenize(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[1]).toMatchObject({ kind: "heredoc", value: "hello {world}" });
    expect(result.tokens[1]?.raw).toBe("<<BODY\nhello {world}\nBODY");
  });

  it("leaves closing-line arguments available and strips marker indentation", () => {
    const result = tokenize("respond <<BODY\n  hello\n  BODY 200\n");
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[1]).toMatchObject({
      kind: "heredoc",
      raw: "<<BODY\n  hello\n  BODY",
      value: "hello",
    });
    expect(result.tokens.map(({ value }) => value)).toContain("200");
  });

  it("reports a missing heredoc closing marker", () => {
    const result = tokenize("respond <<BODY\nhello\n");
    expect(result.diagnostics).toMatchObject([{ code: "unterminated-heredoc" }]);
  });

  it("rejects invalid heredoc markers without losing the source token", () => {
    const result = tokenize("respond <<BAD!\n");
    expect(result.tokens[1]).toMatchObject({ kind: "word", raw: "<<BAD!" });
    expect(result.diagnostics).toMatchObject([{ code: "invalid-heredoc-marker" }]);
  });

  it("treats empty and spaced heredoc openings as ordinary words", () => {
    expect(tokenize("respond <<\n").tokens[1]).toMatchObject({ kind: "word", value: "<<" });
    expect(tokenize("respond <<NOT A MARKER\n").tokens[1]).toMatchObject({
      kind: "word",
      value: "<<NOT",
    });
  });

  it("keeps backtick contents literal and supports escaped line continuations", () => {
    const source = "respond `one { two }`\nheader +X one\\\ntwo\n";
    const result = tokenize(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[1]).toMatchObject({ kind: "backtick", value: "one { two }" });
    expect(result.tokens.find(({ raw }) => raw.startsWith("one\\"))?.raw).toBe("one\\\ntwo");
  });

  it("tracks UTF-16 offsets and strips a byte order mark", () => {
    const result = tokenize("\uFEFF😀.example {\r\n}\r\n");
    expect(result.tokens[0]?.start.offset).toBe(1);
    expect(result.tokens[0]?.end.character).toBe(10);
    expect(result.tokens.filter(({ kind }) => kind === "newline")).toHaveLength(2);
  });
});
