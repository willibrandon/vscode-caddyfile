import type {
  CoreDiagnostic,
  SourcePosition,
  TextSpan,
  Token,
  TokenKind,
  TokenizationResult,
} from "./types.js";

const heredocMarkerPattern = /^[A-Za-z0-9_-]+$/u;

interface Cursor {
  offset: number;
  line: number;
  character: number;
}

interface CodePoint {
  readonly value: string;
  readonly width: number;
}

export function tokenize(text: string): TokenizationResult {
  const tokens: Token[] = [];
  const diagnostics: CoreDiagnostic[] = [];
  const cursor: Cursor = { offset: text.startsWith("\uFEFF") ? 1 : 0, line: 0, character: 0 };

  while (cursor.offset < text.length) {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined) break;

    if (current.value === "\r" || current.value === "\n") {
      tokens.push(readNewline(text, cursor));
      continue;
    }
    if (isWhitespace(current.value)) {
      advance(cursor, current.value, current.width);
      continue;
    }

    const start = snapshot(cursor);
    if (current.value === "#") {
      tokens.push(readComment(text, cursor, start));
      continue;
    }
    if (current.value === '"') {
      tokens.push(readQuoted(text, cursor, start, '"', "quoted", diagnostics));
      continue;
    }
    if (current.value === "`") {
      tokens.push(readQuoted(text, cursor, start, "`", "backtick", diagnostics));
      continue;
    }
    if (text.startsWith("<<", cursor.offset) && !text.startsWith("<<<", cursor.offset)) {
      const heredoc = readHeredoc(text, cursor, start, diagnostics);
      if (heredoc !== undefined) {
        tokens.push(heredoc);
        continue;
      }
    }
    tokens.push(readWord(text, cursor, start));
  }

  return { diagnostics, tokens };
}

function readNewline(text: string, cursor: Cursor): Token {
  const start = snapshot(cursor);
  let raw: string;
  if (text.startsWith("\r\n", cursor.offset)) {
    raw = "\r\n";
    advance(cursor, "\r", 1);
    advance(cursor, "\n", 1);
  } else {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined) return token("newline", "", "", start, snapshot(cursor));
    raw = current.value;
    advance(cursor, current.value, current.width);
  }
  return token("newline", "\n", raw, start, snapshot(cursor));
}

function readComment(text: string, cursor: Cursor, start: SourcePosition): Token {
  while (cursor.offset < text.length) {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined || current.value === "\r" || current.value === "\n") break;
    advance(cursor, current.value, current.width);
  }
  const raw = text.slice(start.offset, cursor.offset);
  return token("comment", raw.slice(1), raw, start, snapshot(cursor));
}

function readQuoted(
  text: string,
  cursor: Cursor,
  start: SourcePosition,
  delimiter: '"' | "`",
  kind: "quoted" | "backtick",
  diagnostics: CoreDiagnostic[],
): Token {
  advance(cursor, delimiter, 1);
  let escaped = false;
  let closed = false;
  let value = "";
  while (cursor.offset < text.length) {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined) break;
    advance(cursor, current.value, current.width);
    if (delimiter === '"' && escaped) {
      value += current.value === '"' ? '"' : `\\${current.value}`;
      escaped = false;
      continue;
    }
    if (delimiter === '"' && current.value === "\\") {
      escaped = true;
      continue;
    }
    if (current.value === delimiter) {
      closed = true;
      break;
    }
    value += current.value;
  }
  if (escaped) value += "\\";
  const end = snapshot(cursor);
  if (!closed) {
    diagnostics.push({
      code: "unterminated-string",
      message: delimiter === '"' ? "Unterminated quoted string." : "Unterminated backtick string.",
      severity: "error",
      span: { start: start.offset, end: end.offset },
    });
  }
  return token(kind, value, text.slice(start.offset, end.offset), start, end);
}

function readHeredoc(
  text: string,
  cursor: Cursor,
  start: SourcePosition,
  diagnostics: CoreDiagnostic[],
): Token | undefined {
  const openingEnd = lineEnd(text, cursor.offset);
  const opening = text.slice(cursor.offset + 2, openingEnd).replace(/\r$/u, "");
  if (opening.includes(" ") || opening.includes("\t")) return undefined;
  if (!heredocMarkerPattern.test(opening)) {
    if (opening.length === 0) {
      return undefined;
    }
    consumeUntil(text, cursor, openingEnd);
    diagnostics.push({
      code: "invalid-heredoc-marker",
      message: "A heredoc marker may contain only letters, numbers, dashes, and underscores.",
      severity: "error",
      span: { start: start.offset, end: cursor.offset },
    });
    return token(
      "word",
      text.slice(start.offset, cursor.offset),
      text.slice(start.offset, cursor.offset),
      start,
      snapshot(cursor),
    );
  }

  consumeUntil(text, cursor, openingEnd);
  if (cursor.offset < text.length) {
    const newline = readNewline(text, cursor);
    void newline;
  }
  const contentStart = cursor.offset;
  let contentEnd = text.length;
  let indentation = "";
  let found = false;
  while (cursor.offset < text.length) {
    const markerLineStart = cursor.offset;
    const markerLineEnd = lineEnd(text, markerLineStart);
    const line = text.slice(markerLineStart, markerLineEnd).replace(/\r$/u, "");
    const trimmed = line.trimStart();
    if (
      trimmed === opening ||
      trimmed.startsWith(opening + " ") ||
      trimmed.startsWith(opening + "\t")
    ) {
      indentation = line.slice(0, line.length - trimmed.length);
      contentEnd = markerLineStart;
      consumeUntil(text, cursor, markerLineStart + indentation.length + opening.length);
      found = true;
      break;
    }
    consumeUntil(text, cursor, markerLineEnd);
    if (cursor.offset < text.length) {
      const newline = readNewline(text, cursor);
      void newline;
    }
  }
  const end = snapshot(cursor);
  if (!found) {
    diagnostics.push({
      code: "unterminated-heredoc",
      message: `Unterminated heredoc. Expected closing marker ${opening}.`,
      severity: "error",
      span: { start: start.offset, end: end.offset },
    });
  }
  const content = dedentHeredoc(
    text.slice(contentStart, contentEnd).replace(/(?:\r?\n)$/u, ""),
    indentation,
  );
  return token("heredoc", content, text.slice(start.offset, end.offset), start, end);
}

function dedentHeredoc(content: string, indentation: string): string {
  if (indentation === "") return content;
  return content
    .split("\n")
    .map((line) => (line.startsWith(indentation) ? line.slice(indentation.length) : line))
    .join("\n");
}

function readWord(text: string, cursor: Cursor, start: SourcePosition): Token {
  let escaped = false;
  while (cursor.offset < text.length) {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined) break;
    if (escaped && (current.value === "\r" || current.value === "\n")) {
      if (current.value === "\r" && text.startsWith("\r\n", cursor.offset)) {
        advance(cursor, "\r", 1);
      }
      advance(cursor, "\n", 1);
      escaped = false;
      continue;
    }
    if (!escaped && isWhitespace(current.value)) break;
    advance(cursor, current.value, current.width);
    escaped = !escaped && current.value === "\\";
    if (current.value !== "\\") escaped = false;
  }
  const raw = text.slice(start.offset, cursor.offset);
  const kind: TokenKind = raw === "{" ? "open-brace" : raw === "}" ? "close-brace" : "word";
  return token(kind, raw, raw, start, snapshot(cursor));
}

function token(
  kind: TokenKind,
  value: string,
  raw: string,
  start: SourcePosition,
  end: SourcePosition,
): Token {
  return { end, kind, raw, span: span(start.offset, end.offset), start, value };
}

function span(start: number, end: number): TextSpan {
  return { end, start };
}

function snapshot(cursor: Cursor): SourcePosition {
  return { character: cursor.character, line: cursor.line, offset: cursor.offset };
}

function advance(cursor: Cursor, value: string, width: number): void {
  cursor.offset += width;
  if (value === "\n") {
    cursor.line++;
    cursor.character = 0;
  } else if (value !== "\r") {
    cursor.character += width;
  }
}

function codePointAt(text: string, offset: number): CodePoint | undefined {
  const numeric = text.codePointAt(offset);
  if (numeric === undefined) return undefined;
  const value = String.fromCodePoint(numeric);
  return { value, width: value.length };
}

function isWhitespace(value: string): boolean {
  return /\s/u.test(value);
}

function lineEnd(text: string, offset: number): number {
  const newline = text.indexOf("\n", offset);
  return newline === -1 ? text.length : newline;
}

function consumeUntil(text: string, cursor: Cursor, target: number): void {
  while (cursor.offset < target) {
    const current = codePointAt(text, cursor.offset);
    if (current === undefined) break;
    advance(cursor, current.value, current.width);
  }
}
