import { languageItemFor, languageItemsFor } from "./registry.js";
import type { LanguageItem, LanguageValue, ParsedDocument, Statement, Token } from "./types.js";

export interface LanguageSelection {
  readonly arguments: readonly Token[];
  readonly item: LanguageItem;
  readonly nameToken: Token;
  readonly statement: Statement;
}

export function selectionFor(
  document: ParsedDocument,
  statement: Statement,
): LanguageSelection | undefined {
  if (statement.kind === "matcher") {
    const nameToken = statement.tokens[1];
    const item =
      nameToken === undefined ? undefined : languageItemFor(nameToken.value, ["matcher"]);
    return nameToken === undefined || item === undefined
      ? undefined
      : {
          arguments: valueArguments(statement.tokens, nameToken, item),
          item,
          nameToken,
          statement,
        };
  }
  const nameToken = statement.tokens[0];
  if (nameToken === undefined) return undefined;
  const parent = statement.parent === undefined ? undefined : document.statements[statement.parent];
  const contextual =
    parent === undefined
      ? undefined
      : parent.kind === "global-options"
        ? languageItemFor(statement.name, ["global-option"])
        : parent.kind === "matcher"
          ? languageItemFor(statement.name, ["matcher"])
          : subdirectivesForParent(parent).find(({ name }) => name === statement.name);
  const item =
    contextual ??
    languageItemFor(
      statement.name,
      statement.kind === "global-option"
        ? ["global-option"]
        : statement.kind === "subdirective"
          ? ["subdirective"]
          : ["directive"],
    );
  return item === undefined
    ? undefined
    : {
        arguments: valueArguments(statement.tokens, nameToken, item),
        item,
        nameToken,
        statement,
      };
}

export function subdirectivesForParent(parent: Statement): readonly LanguageItem[] {
  const qualified = `${parent.kind}:${parent.name}`;
  return languageItemsFor("subdirective").filter(({ parents }) =>
    parents?.some((candidate) => candidate === parent.name || candidate === qualified),
  );
}

export function valuesAtArgument(item: LanguageItem, argument: number): readonly LanguageValue[] {
  const valueArgument = item.valueArgument ?? 0;
  return (item.values ?? []).filter(({ arguments: explicitArguments }) =>
    explicitArguments === undefined
      ? argument === valueArgument || (item.repeatValues === true && argument >= valueArgument)
      : explicitArguments.includes(argument),
  );
}

function valueArguments(
  tokens: readonly Token[],
  nameToken: Token,
  item: LanguageItem,
): readonly Token[] {
  const arguments_ = tokens.filter(
    ({ kind, span }) => kind !== "open-brace" && span.start >= nameToken.span.end,
  );
  return item.kind === "directive" && arguments_[0]?.value.startsWith("@") === true
    ? arguments_.slice(1)
    : arguments_;
}
