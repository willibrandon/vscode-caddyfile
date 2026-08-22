import { tokenize } from "./lexer.js";
import { languageItemFor } from "./registry.js";
import type {
  CoreDiagnostic,
  ParsedDocument,
  Statement,
  StatementKind,
  SymbolDefinition,
  SymbolReference,
  TextSpan,
  Token,
} from "./types.js";

export function parseCaddyfile(text: string): ParsedDocument {
  const tokenization = tokenize(text);
  const statements: Statement[] = [];
  const diagnostics: CoreDiagnostic[] = [...tokenization.diagnostics];
  const stack: number[] = [];
  let current: Token[] = [];
  let seenTopLevelContent = false;

  const flush = (opensBlock: boolean): number | undefined => {
    if (current.length === 0) return undefined;
    const parent = stack.at(-1);
    const kind = classify(
      current,
      parent === undefined ? undefined : statements[parent],
      statements,
    );
    const nameToken = current[0];
    if (nameToken === undefined) return undefined;
    const name =
      kind === "site"
        ? current
            .filter(({ kind: tokenKind }) => tokenKind !== "open-brace")
            .map(({ value }) => value)
            .join(" ")
        : nameToken.value;
    const statement: Statement = {
      depth: stack.length,
      kind,
      name,
      nameSpan: nameToken.span,
      opensBlock,
      parent,
      span: { start: nameToken.span.start, end: current.at(-1)?.span.end ?? nameToken.span.end },
      tokens: current,
    };
    const index = statements.push(statement) - 1;
    if (statement.depth === 0) {
      if (statement.kind === "global-options" && seenTopLevelContent) {
        diagnostics.push({
          code: "global-options-order",
          message: "The global options block must be the first block in the Caddyfile.",
          severity: "error",
          span: statement.nameSpan,
        });
      }
      seenTopLevelContent = true;
    }
    for (const token of current) {
      if (token.kind === "word" && token.value.endsWith("{") && token.value !== "{") {
        diagnostics.push({
          code: "missing-space-before-brace",
          message: "Put a space before the opening brace.",
          severity: "error",
          span: token.span,
        });
      }
    }
    current = [];
    return index;
  };

  for (const token of tokenization.tokens) {
    if (token.kind === "comment") continue;
    if (token.kind === "newline") {
      if (
        stack.length === 0 &&
        current.length > 0 &&
        current.at(-1)?.value.endsWith(",") === true
      ) {
        continue;
      }
      flush(false);
      continue;
    }
    if (token.kind === "open-brace") {
      current.push(token);
      const opened = flush(true);
      if (opened !== undefined) stack.push(opened);
      continue;
    }
    if (token.kind === "close-brace") {
      flush(false);
      const opened = stack.pop();
      if (opened === undefined) {
        diagnostics.push({
          code: "unexpected-close-brace",
          message: "Unexpected closing brace.",
          severity: "error",
          span: token.span,
        });
      } else {
        const statement = statements[opened];
        if (statement !== undefined) {
          statements[opened] = {
            ...statement,
            span: { start: statement.span.start, end: token.span.end },
          };
        }
      }
      continue;
    }
    current.push(token);
  }
  flush(false);

  for (const opened of stack) {
    const statement = statements[opened];
    if (statement === undefined) continue;
    diagnostics.push({
      code: "unclosed-block",
      message: `The ${displayKind(statement.kind)} block is missing a closing brace.`,
      severity: "error",
      span: statement.nameSpan,
    });
  }

  const definitions = collectDefinitions(statements);
  const references = collectReferences(statements, definitions);
  addDuplicateDiagnostics(definitions, diagnostics);
  addReferenceDiagnostics(references, definitions, diagnostics);
  return {
    definitions,
    diagnostics,
    references,
    statements,
    text,
    tokens: tokenization.tokens,
  };
}

function classify(
  tokens: readonly Token[],
  parent: Statement | undefined,
  statements: readonly Statement[],
): StatementKind {
  const name = tokens[0]?.value ?? "";
  if (parent === undefined) {
    if (name === "{") return "global-options";
    if (/^\([^()]+\)$/u.test(name)) return "snippet";
    if (/^&\([^()]+\)$/u.test(name)) return "named-route";
    if (name === "import") return "import";
    if (languageItemFor(name, ["directive"]) !== undefined || hasImplicitSite(statements)) {
      return "directive";
    }
    return "site";
  }
  if (parent.kind === "global-options") return "global-option";
  if (name === "import") return "import";
  if (name.startsWith("@")) return "matcher";
  if (["site", "snippet", "named-route"].includes(parent.kind)) return "directive";
  if (languageItemFor(name, ["directive"]) !== undefined) return "directive";
  return "subdirective";
}

function hasImplicitSite(statements: readonly Statement[]): boolean {
  return statements.some((statement) => statement.depth === 0 && statement.kind === "directive");
}

function collectDefinitions(statements: readonly Statement[]): readonly SymbolDefinition[] {
  const definitions: SymbolDefinition[] = [];
  for (const statement of statements) {
    if (statement.kind === "snippet") {
      definitions.push({
        kind: "snippet",
        name: statement.name.slice(1, -1),
        span: statement.nameSpan,
      });
    } else if (statement.kind === "named-route") {
      definitions.push({
        kind: "named-route",
        name: statement.name.slice(2, -1),
        span: statement.nameSpan,
      });
    } else if (statement.kind === "matcher") {
      definitions.push({
        kind: "matcher",
        name: statement.name.slice(1),
        span: statement.nameSpan,
      });
    }
  }
  return definitions;
}

function collectReferences(
  statements: readonly Statement[],
  definitions: readonly SymbolDefinition[],
): readonly SymbolReference[] {
  const references: SymbolReference[] = [];
  const snippetNames = new Set(
    definitions.filter(({ kind }) => kind === "snippet").map(({ name }) => name),
  );
  for (const statement of statements) {
    const args = statement.tokens.slice(1).filter(({ kind }) => kind !== "open-brace");
    if (statement.kind === "import") {
      const target = args[0];
      if (target !== undefined) {
        references.push({
          kind: snippetNames.has(target.value) ? "snippet" : "import",
          name: target.value,
          span: target.span,
        });
      }
    }
    if (statement.name === "invoke") {
      const target = args.find(({ value }) => !value.startsWith("@"));
      if (target !== undefined)
        references.push({ kind: "named-route", name: target.value, span: target.span });
    }
    for (const argument of args) {
      if (argument.value.startsWith("@") && argument.value.length > 1) {
        references.push({ kind: "matcher", name: argument.value.slice(1), span: argument.span });
      }
    }
  }
  return references;
}

function addDuplicateDiagnostics(
  definitions: readonly SymbolDefinition[],
  diagnostics: CoreDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const definition of definitions) {
    const key = `${definition.kind}:${definition.name}`;
    if (seen.has(key)) {
      diagnostics.push({
        code: `duplicate-${definition.kind}`,
        message: `Duplicate ${definition.kind.replace("-", " ")} '${definition.name}'.`,
        severity: "error",
        span: definition.span,
      });
    }
    seen.add(key);
  }
}

function addReferenceDiagnostics(
  references: readonly SymbolReference[],
  definitions: readonly SymbolDefinition[],
  diagnostics: CoreDiagnostic[],
): void {
  const keys = new Set(definitions.map(({ kind, name }) => `${kind}:${name}`));
  for (const reference of references) {
    if (reference.kind === "import" || keys.has(`${reference.kind}:${reference.name}`)) continue;
    diagnostics.push({
      code: `undefined-${reference.kind}`,
      message: `No ${reference.kind.replace("-", " ")} named '${reference.name}' is defined in this file.`,
      severity: "warning",
      span: reference.span,
    });
  }
}

function displayKind(kind: StatementKind): string {
  return kind.replace("-", " ");
}

export function spanContains(span: TextSpan, offset: number): boolean {
  return offset >= span.start && offset <= span.end;
}
