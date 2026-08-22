import { allLanguageItems, languageItemFor, languageItemsFor } from "./registry.js";
import { spanContains } from "./parser.js";
import type {
  CoreCompletion,
  CoreHover,
  LanguageItem,
  ParsedDocument,
  SemanticSpan,
  Statement,
  SymbolDefinition,
  TextSpan,
  Token,
} from "./types.js";

export function completionsAt(document: ParsedDocument, offset: number): readonly CoreCompletion[] {
  const statement = statementAt(document, offset);
  const items = completionItemsFor(document, statement, offset);
  const prefix = wordPrefix(document.text, offset);
  return items
    .filter(({ name }) => prefix.length === 0 || name.startsWith(prefix))
    .map(toCompletion)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function hoverAt(document: ParsedDocument, offset: number): CoreHover | undefined {
  const token = tokenAt(document, offset);
  if (token === undefined || token.kind === "comment" || token.kind === "newline") return undefined;
  const statement = document.statements.find(({ nameSpan }) => spanContains(nameSpan, offset));
  const kinds =
    statement?.kind === "global-option"
      ? (["global-option"] as const)
      : statement?.kind === "subdirective"
        ? (["subdirective", "directive", "matcher"] as const)
        : (["directive", "global-option", "matcher", "subdirective"] as const);
  const item = languageItemFor(token.value, kinds);
  if (item === undefined) return symbolHover(document, token);
  return { markdown: itemMarkdown(item), span: token.span };
}

export function definitionAt(
  document: ParsedDocument,
  offset: number,
): SymbolDefinition | undefined {
  const reference = document.references.find(({ span }) => spanContains(span, offset));
  if (reference === undefined || reference.kind === "import") return undefined;
  return document.definitions.find(
    ({ kind, name }) => kind === reference.kind && name === reference.name,
  );
}

export function referencesAt(document: ParsedDocument, offset: number): readonly TextSpan[] {
  const definition = document.definitions.find(({ span }) => spanContains(span, offset));
  const reference = document.references.find(({ span }) => spanContains(span, offset));
  const symbol = definition ?? reference;
  if (symbol === undefined || symbol.kind === "import") return [];
  return [
    ...document.definitions
      .filter(({ kind, name }) => kind === symbol.kind && name === symbol.name)
      .map(({ span }) => span),
    ...document.references
      .filter(({ kind, name }) => kind === symbol.kind && name === symbol.name)
      .map(({ span }) => span),
  ];
}

export function semanticSpans(document: ParsedDocument): readonly SemanticSpan[] {
  const spans: SemanticSpan[] = [];
  for (const token of document.tokens) {
    if (token.kind === "comment") spans.push({ span: token.span, type: "comment" });
    else if (["quoted", "backtick", "heredoc"].includes(token.kind)) {
      spans.push({ span: token.span, type: "string" });
    } else if (/^-?\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h|d)?$/u.test(token.value)) {
      spans.push({ span: token.span, type: "number" });
    }
    for (const placeholder of placeholderSpans(token.raw)) {
      spans.push({
        span: {
          start: token.span.start + placeholder.start,
          end: token.span.start + placeholder.end,
        },
        type: "variable",
      });
    }
  }
  for (const statement of document.statements) {
    const item = languageItemFor(statement.name);
    if (statement.kind === "global-option") {
      spans.push({
        deprecated: item?.deprecated !== undefined,
        span: statement.nameSpan,
        type: "property",
      });
    } else if (["directive", "subdirective"].includes(statement.kind)) {
      spans.push({
        deprecated: item?.deprecated !== undefined,
        span: statement.nameSpan,
        type: "keyword",
      });
    } else if (["matcher", "snippet", "named-route"].includes(statement.kind)) {
      spans.push({ span: statement.nameSpan, type: "variable" });
    }
  }
  return spans;
}

function placeholderSpans(value: string): readonly TextSpan[] {
  const spans: TextSpan[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "{") continue;
    const start = index;
    index += 1;
    if (value[index] === "$") {
      index += 1;
      if (!isEnvironmentNameStart(value[index])) continue;
      while (isEnvironmentNamePart(value[index])) index += 1;
      if (value[index] === ":") {
        while (index < value.length && value[index] !== "}") index += 1;
      }
    } else {
      const nameStart = index;
      while (isPlaceholderNamePart(value[index])) index += 1;
      if (index === nameStart) continue;
    }
    if (value[index] === "}") spans.push({ start, end: index + 1 });
  }
  return spans;
}

function isEnvironmentNameStart(value: string | undefined): boolean {
  return value !== undefined && ((value >= "A" && value <= "Z") || value === "_");
}

function isEnvironmentNamePart(value: string | undefined): boolean {
  return isEnvironmentNameStart(value) || (value !== undefined && value >= "0" && value <= "9");
}

function isPlaceholderNamePart(value: string | undefined): boolean {
  return (
    value !== undefined &&
    ((value >= "A" && value <= "Z") ||
      (value >= "a" && value <= "z") ||
      (value >= "0" && value <= "9") ||
      value === "_" ||
      value === "." ||
      value === "-")
  );
}

export function languageCoverage(): Readonly<Record<string, number>> {
  return {
    directives: languageItemsFor("directive").length,
    globalOptions: languageItemsFor("global-option").length,
    matchers: languageItemsFor("matcher").length,
    subdirectives: languageItemsFor("subdirective").length,
  };
}

function completionItemsFor(
  document: ParsedDocument,
  statement: Statement | undefined,
  offset: number,
): readonly LanguageItem[] {
  if (statement?.kind === "global-option") return languageItemsFor("global-option");
  if (statement?.kind === "matcher") return languageItemsFor("matcher");
  if (statement?.kind === "subdirective") {
    const parent =
      statement.parent === undefined ? undefined : document.statements[statement.parent];
    if (parent?.kind === "matcher") return languageItemsFor("matcher");
    if (parent !== undefined) {
      const matching = languageItemsFor("subdirective").filter(({ parents }) =>
        parents?.includes(parent.name),
      );
      if (matching.length > 0) return matching;
    }
  }
  const lineStart = document.text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  if (document.text.slice(lineStart, offset).trimStart().startsWith("@")) {
    return languageItemsFor("matcher");
  }
  return languageItemsFor("directive");
}

function toCompletion(item: LanguageItem): CoreCompletion {
  return {
    deprecated: item.deprecated !== undefined,
    detail: item.syntax,
    documentation: `${item.summary}\n\n[Official documentation](${item.url})`,
    label: item.name,
  };
}

function itemMarkdown(item: LanguageItem): string {
  const deprecated =
    item.deprecated === undefined ? "" : `\n\n**Deprecated:** ${item.deprecated.message}`;
  const values = item.values === undefined ? "" : `\n\nValues: ${item.values.join(", ")}.`;
  return `**${item.name}**\n\n${item.summary}\n\n\`\`\`caddyfile\n${item.syntax}\n\`\`\`${values}${deprecated}\n\n[Official documentation](${item.url})`;
}

function symbolHover(document: ParsedDocument, token: Token): CoreHover | undefined {
  const definition = document.definitions.find(({ span }) => spanContains(span, token.span.start));
  if (definition === undefined) return undefined;
  return {
    markdown: `**${definition.name}**\n\n${definition.kind.replace("-", " ")} defined in this Caddyfile.`,
    span: token.span,
  };
}

function statementAt(document: ParsedDocument, offset: number): Statement | undefined {
  return document.statements
    .filter(({ span }) => spanContains(span, offset))
    .sort(
      (left, right) =>
        right.depth - left.depth ||
        left.span.end - left.span.start - (right.span.end - right.span.start),
    )[0];
}

function tokenAt(document: ParsedDocument, offset: number): Token | undefined {
  return document.tokens.find(({ span }) => spanContains(span, offset));
}

function wordPrefix(text: string, offset: number): string {
  const prefix = /[A-Za-z0-9_-]+$/u.exec(text.slice(0, offset));
  return prefix?.[0] ?? "";
}

export function allKnownNames(): readonly string[] {
  return allLanguageItems.map(({ name }) => name);
}
