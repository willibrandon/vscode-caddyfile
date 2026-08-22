/*
 * Derived from caddyconfig/caddyfile/formatter.go in Caddy.
 * Copyright 2015 Matthew Holt and The Caddy Authors.
 * Licensed under the Apache License, Version 2.0.
 */

const validHeredocMarker = /^[A-Za-z0-9_-]+$/u;

type HeredocState = "closed" | "opening" | "opened";

export function formatCaddyfile(source: string): string {
  const input = source.trim();
  let output = "";
  let last = "";
  let space = true;
  let beginningOfLine = true;
  let openBrace = false;
  let openBraceWritten = false;
  let openBraceSpace = false;
  let newLines = 0;
  let comment = false;
  let quotes = "";
  let escaped = false;
  let heredoc: HeredocState = "closed";
  let heredocEscaped = false;
  let heredocMarker = "";
  let heredocClosingMarker = "";
  let nesting = 0;
  let currentToken = "";
  let currentLineFirstToken = "";
  let previousLineWasTopLevelImport = false;
  let openBraceOwnLine = false;

  const finishToken = (): void => {
    if (currentToken.length === 0) return;
    if (currentLineFirstToken.length === 0) currentLineFirstToken = currentToken;
    currentToken = "";
  };
  const finishLine = (): void => {
    finishToken();
    if (currentLineFirstToken.length > 0) {
      previousLineWasTopLevelImport = nesting === 0 && currentLineFirstToken === "import";
    } else if (!openBrace || !openBraceOwnLine || openBraceWritten) {
      previousLineWasTopLevelImport = false;
    }
    currentLineFirstToken = "";
  };
  const write = (character: string): void => {
    output += character;
    last = character;
  };
  const indent = (): void => {
    for (let tabs = nesting; tabs > 0; tabs--) write("\t");
  };
  const nextLine = (): void => {
    write("\n");
    beginningOfLine = true;
  };
  const topLevelImportBraceOnOwnLine = (): boolean =>
    openBraceOwnLine && previousLineWasTopLevelImport;

  for (const character of input) {
    const ch = character;
    if (
      quotes === "" &&
      heredoc === "closed" &&
      !heredocEscaped &&
      space &&
      last === "<" &&
      ch === "<"
    ) {
      write(ch);
      heredoc = "opening";
      space = false;
      continue;
    }

    if (heredoc === "opening") {
      if (ch === "\n") {
        if (heredocMarker.length > 0 && validHeredocMarker.test(heredocMarker)) {
          heredoc = "opened";
        } else {
          heredocMarker = "";
          heredoc = "closed";
          nextLine();
          continue;
        }
        write(ch);
        continue;
      }
      if (isSpace(ch)) {
        heredocMarker = "";
        heredoc = "closed";
      } else {
        heredocMarker += ch;
        write(ch);
        continue;
      }
    }

    if (heredoc === "opened") {
      heredocClosingMarker = `${heredocClosingMarker}${ch}`.slice(-(heredocMarker.length + 1));
      if (isSpace(ch) && heredocClosingMarker.slice(0, -1) === heredocMarker) {
        heredocMarker = "";
        heredocClosingMarker = "";
        heredoc = "closed";
      } else {
        write(ch);
        if (ch === "\n") heredocClosingMarker = "";
        continue;
      }
    }

    if (last === "<" && space) space = false;

    if (comment) {
      if (ch === "\n") {
        comment = false;
        space = true;
        nextLine();
      } else {
        write(ch);
      }
      continue;
    }

    if (!escaped && ch === "\\") {
      if (space) {
        write(" ");
        space = false;
      }
      write(ch);
      escaped = true;
      continue;
    }

    if (escaped) {
      if (ch === "<") heredocEscaped = true;
      write(ch);
      escaped = false;
      continue;
    }

    if (ch === "`") {
      switch (quotes) {
        case '"`':
          quotes = '"';
          break;
        case "`":
          quotes = "";
          break;
        case '"':
          quotes = '"`';
          break;
        default:
          quotes = "`";
      }
    }

    if (quotes === '"') {
      if (ch === '"') quotes = "";
      write(ch);
      continue;
    }

    if (ch === '"') {
      switch (quotes) {
        case "":
          if (space) quotes = '"';
          break;
        case '`"':
          quotes = "`";
          break;
        case '"`':
          quotes = "";
          break;
      }
    }

    if (quotes.includes("`")) {
      if (ch === "`" && space && !beginningOfLine) write(" ");
      write(ch);
      space = false;
      continue;
    }

    if (isSpace(ch)) {
      finishToken();
      space = true;
      heredocEscaped = false;
      if (ch === "\n") {
        finishLine();
        newLines++;
      }
      continue;
    }
    const spacePrior = space;
    space = false;

    if (ch === "#") comment = true;

    if (openBrace && spacePrior && !openBraceWritten) {
      if (nesting === 0 && last === "}") {
        nextLine();
        nextLine();
      }
      openBrace = false;
      if (topLevelImportBraceOnOwnLine()) {
        if (last !== "\n") nextLine();
        indent();
      } else if (beginningOfLine) {
        indent();
      } else if (!openBraceSpace || !isSpace(last)) {
        write(" ");
      }
      write("{");
      openBraceWritten = true;
      openBraceOwnLine = false;
      nextLine();
      newLines = 0;
      if (nesting < 10) nesting++;
    }

    if (ch === "{") {
      finishToken();
      openBrace = true;
      openBraceSpace = spacePrior && !beginningOfLine;
      openBraceOwnLine = newLines > 0;
      if (openBraceSpace && newLines === 0) write(" ");
      openBraceWritten = false;
      if (quotes === "`") {
        write("{");
        openBraceWritten = true;
        openBraceOwnLine = false;
      }
      continue;
    }

    if (ch === "}" && (spacePrior || !openBrace)) {
      finishToken();
      if (quotes === "`") {
        write("}");
        continue;
      }
      if (last !== "\n") nextLine();
      if (nesting > 0) nesting--;
      indent();
      write("}");
      newLines = 0;
      continue;
    }

    if (newLines > 2) newLines = 2;
    for (let line = 0; line < newLines; line++) nextLine();
    newLines = 0;
    if (beginningOfLine) indent();
    if (nesting === 0 && last === "}" && beginningOfLine) {
      nextLine();
      nextLine();
    }
    if (!beginningOfLine && spacePrior) write(" ");
    if (openBrace && !openBraceWritten) {
      write("{");
      openBraceWritten = true;
    }
    if (spacePrior && ch === "<") space = true;
    currentToken += ch;
    write(ch);
    beginningOfLine = false;
  }

  return `${output.trim()}\n`;
}

function isSpace(value: string): boolean {
  return /\s/u.test(value);
}
