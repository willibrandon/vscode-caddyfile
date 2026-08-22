import { allLanguageItems, languageItemFor, languageItemsFor } from "./registry.js";
import { selectionFor, subdirectivesForParent, valuesAtArgument } from "./language-selection.js";
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
  const current = statementOnLine(document, offset);
  const selection = current === undefined ? undefined : selectionFor(document, current);
  if (selection !== undefined && isAfterName(document.text, selection.nameToken, offset)) {
    const argumentIndex = activeArgumentIndex(selection.arguments, offset);
    const values = valuesAtArgument(selection.item, argumentIndex);
    if (values.length === 0) return [];
    const prefix = argumentPrefix(selection.arguments, argumentIndex, offset);
    return values
      .filter(({ name }) => prefix.length === 0 || name.startsWith(prefix))
      .map((value) => valueCompletion(selection.item, value))
      .sort((left, right) => left.label.localeCompare(right.label));
  }
  const items = completionItemsFor(document, current, offset);
  const prefix = wordPrefix(document.text, offset);
  return items
    .filter(({ name }) => prefix.length === 0 || name.startsWith(prefix))
    .map(toCompletion)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function hoverAt(document: ParsedDocument, offset: number): CoreHover | undefined {
  const token = tokenAt(document, offset);
  if (token === undefined || token.kind === "comment" || token.kind === "newline") return undefined;
  const statement = statementForToken(document, token);
  const selection = statement === undefined ? undefined : selectionFor(document, statement);
  if (selection === undefined) return symbolHover(document, token);
  if (sameSpan(token.span, selection.nameToken.span)) {
    return { markdown: itemMarkdown(selection.item), span: token.span };
  }
  const argumentIndex = selection.arguments.findIndex(({ span }) => sameSpan(span, token.span));
  if (argumentIndex >= 0) {
    const value = valuesAtArgument(selection.item, argumentIndex).find(
      ({ name }) => name === token.value,
    );
    if (value !== undefined) {
      return {
        markdown: `**${value.name}**\n\n${value.summary}\n\nValue for \`${selection.item.name}\`.\n\n[Official documentation](${selection.item.url})`,
        span: token.span,
      };
    }
  }
  return symbolHover(document, token);
}

export function languageItemAt(document: ParsedDocument, offset: number): LanguageItem | undefined {
  const statement = statementOnLine(document, offset) ?? statementAt(document, offset);
  return statement === undefined ? undefined : selectionFor(document, statement)?.item;
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
      const name = value.slice(nameStart, index);
      if ((name === "args" || name === "block") && value[index] === "[") {
        index += 1;
        while (index < value.length && value[index] !== "]" && value[index] !== "\n") index += 1;
        if (value[index] !== "]") continue;
        index += 1;
      }
    }
    if (value[index] === "}") spans.push({ start, end: index + 1 });
  }
  return spans;
}

function isEnvironmentNameStart(value: string | undefined): boolean {
  return (
    value !== undefined &&
    ((value >= "A" && value <= "Z") || (value >= "a" && value <= "z") || value === "_")
  );
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
  const lineStart = document.text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  if (document.text.slice(lineStart, offset).trimStart().startsWith("@")) {
    return languageItemsFor("matcher");
  }
  const parent =
    statement?.parent === undefined
      ? enclosingBlock(document, offset)
      : document.statements[statement.parent];
  if (statement?.kind === "global-option" || parent?.kind === "global-options") {
    return languageItemsFor("global-option");
  }
  if (statement?.kind === "matcher" || parent?.kind === "matcher") {
    return languageItemsFor("matcher");
  }
  if (parent !== undefined && !["site", "snippet", "named-route"].includes(parent.kind)) {
    const matching = subdirectivesForParent(parent);
    if (matching.length > 0) return matching;
  }
  return languageItemsFor("directive");
}

function toCompletion(item: LanguageItem): CoreCompletion {
  return {
    deprecated: item.deprecated !== undefined,
    detail: item.syntax,
    documentation: `${item.summary}\n\n[Official documentation](${item.url})`,
    label: item.name,
    kind: "item",
  };
}

function valueCompletion(
  item: LanguageItem,
  value: Readonly<{ readonly name: string; readonly summary: string }>,
): CoreCompletion {
  return {
    detail: `Value for ${item.name}`,
    documentation: `${value.summary}\n\n[Official documentation](${item.url})`,
    kind: "value",
    label: value.name,
  };
}

function itemMarkdown(item: LanguageItem): string {
  const deprecated =
    item.deprecated === undefined ? "" : `\n\n**Deprecated:** ${item.deprecated.message}`;
  const values =
    item.values === undefined
      ? ""
      : `\n\nAccepted values:\n${item.values.map(({ name, summary }) => `- \`${name}\`: ${summary}`).join("\n")}`;
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

function statementOnLine(document: ParsedDocument, offset: number): Statement | undefined {
  const start = document.text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const newline = document.text.indexOf("\n", offset);
  const end = newline < 0 ? document.text.length : newline;
  return document.statements
    .filter(({ nameSpan }) => nameSpan.start >= start && nameSpan.start <= end)
    .sort((left, right) => right.depth - left.depth)[0];
}

function statementForToken(document: ParsedDocument, token: Token): Statement | undefined {
  return document.statements
    .filter(({ tokens }) => tokens.some(({ span }) => sameSpan(span, token.span)))
    .sort((left, right) => right.depth - left.depth)[0];
}

function enclosingBlock(document: ParsedDocument, offset: number): Statement | undefined {
  return document.statements
    .filter(({ opensBlock, span }) => opensBlock && span.start <= offset && span.end >= offset)
    .sort((left, right) => right.depth - left.depth)[0];
}

function isAfterName(text: string, token: Token, offset: number): boolean {
  return offset > token.span.end && /\s/u.test(text.slice(token.span.end, offset));
}

function activeArgumentIndex(arguments_: readonly Token[], offset: number): number {
  const containing = arguments_.findIndex(({ span }) => span.start <= offset && span.end >= offset);
  return containing >= 0 ? containing : arguments_.filter(({ span }) => span.end < offset).length;
}

function argumentPrefix(arguments_: readonly Token[], index: number, offset: number): string {
  const token = arguments_[index];
  return token === undefined || offset < token.span.start
    ? ""
    : token.value.slice(0, Math.max(0, offset - token.span.start));
}

function sameSpan(left: TextSpan, right: TextSpan): boolean {
  return left.start === right.start && left.end === right.end;
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
