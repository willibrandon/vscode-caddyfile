import {
  CADDY_LANGUAGE_DATA_VERSION,
  analyzeCaddyfile,
  completionsAt,
  formatCaddyfile,
  hoverAt,
  languageItemAt,
  languageItemFor,
  parseCaddyfile,
  referencesAt,
  semanticSpans,
  splitCaddyfileTest,
  spanContains,
} from "@caddyfile/language-core";
import type {
  CoreDiagnostic,
  ParsedDocument,
  SemanticSpan,
  Statement,
  SymbolDefinition,
  TextSpan,
} from "@caddyfile/language-core";
import {
  CodeActionKind,
  CompletionItemKind,
  DiagnosticSeverity,
  DiagnosticTag,
  DocumentHighlightKind,
  FoldingRangeKind,
  MarkupKind,
  SemanticTokensBuilder,
  SymbolKind,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver";
import type {
  CodeAction,
  CompletionItem,
  Connection,
  Diagnostic,
  DocumentHighlight,
  DocumentLink,
  DocumentSymbol,
  FoldingRange,
  Hover,
  InitializeParams,
  InitializeResult,
  Location,
  Position,
  Range,
  SelectionRange,
  SemanticTokens,
  SignatureHelp,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI, Utils } from "vscode-uri";
import {
  WorkspaceIndex,
  definitionAtWorkspace,
  importTargets,
  occurrencesAtWorkspace,
  workspaceImportDiagnostics,
} from "./workspace-index.js";

const languageIds = new Set(["caddyfile", "caddyfile-test"]);
const tokenTypes = ["keyword", "string", "number", "comment", "variable", "property"] as const;
const tokenModifiers = ["deprecated"] as const;

interface ServerSettings {
  readonly diagnostics: Readonly<{ readonly unknownItems: "off" | "hint" | "warning" }>;
  readonly validation: Readonly<{ readonly enable: boolean; readonly maxProblems: number }>;
}

const defaultSettings: ServerSettings = {
  diagnostics: { unknownItems: "hint" },
  validation: { enable: true, maxProblems: 200 },
};

export function startLanguageServer(connection: Connection): void {
  const documents = new TextDocuments(TextDocument);
  const workspaceIndex = new WorkspaceIndex();
  const settingsCache = new Map<string, Promise<ServerSettings>>();
  let fallbackSettings = defaultSettings;
  let supportsConfiguration = false;
  let workspaceRoots: readonly string[] = [];

  const parsed = (document: TextDocument): ParsedDocument | undefined =>
    languageIds.has(document.languageId) ? parseCaddyfile(languageSource(document)) : undefined;

  const settingsFor = (uri: string): Promise<ServerSettings> => {
    if (!supportsConfiguration) return Promise.resolve(fallbackSettings);
    const cached = settingsCache.get(uri);
    if (cached !== undefined) return cached;
    const request = connection.workspace
      .getConfiguration({ scopeUri: uri, section: "caddyfile" })
      .then(normalizeSettings, (): ServerSettings => defaultSettings);
    settingsCache.set(uri, request);
    return request;
  };

  const publish = async (document: TextDocument): Promise<void> => {
    const tree = parsed(document);
    const settings = await settingsFor(document.uri);
    if (documents.get(document.uri)?.version !== document.version) return;
    const diagnostics =
      tree === undefined || !settings.validation.enable
        ? []
        : [
            ...analyzeCaddyfile(tree, {
              maxProblems: settings.validation.maxProblems,
              unknownItems: settings.diagnostics.unknownItems,
            }),
            ...(workspaceIndex.ready
              ? workspaceImportDiagnostics(
                  document.uri,
                  workspaceIndex.merged(documents.all()),
                  workspaceRoots,
                )
              : []),
          ]
            .slice(0, settings.validation.maxProblems)
            .map((item) => toDiagnostic(document, item));
    void connection.sendDiagnostics({
      diagnostics,
      uri: document.uri,
      version: document.version,
    });
  };

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    supportsConfiguration = params.capabilities.workspace?.configuration === true;
    return {
      capabilities: {
        codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: [" ", "@", "{", "_"],
        },
        definitionProvider: true,
        documentFormattingProvider: true,
        documentHighlightProvider: true,
        documentLinkProvider: { resolveProvider: false },
        documentRangeFormattingProvider: true,
        documentSymbolProvider: true,
        foldingRangeProvider: true,
        hoverProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        selectionRangeProvider: true,
        semanticTokensProvider: {
          full: true,
          legend: { tokenModifiers: [...tokenModifiers], tokenTypes: [...tokenTypes] },
        },
        signatureHelpProvider: { triggerCharacters: [" ", "@"] },
        textDocumentSync: TextDocumentSyncKind.Incremental,
        workspaceSymbolProvider: true,
      },
      serverInfo: {
        name: "Caddyfile Language Server",
        version: CADDY_LANGUAGE_DATA_VERSION,
      },
    };
  });

  connection.onDidChangeConfiguration((event): void => {
    settingsCache.clear();
    if (!supportsConfiguration) {
      const eventSettings: unknown = event.settings;
      fallbackSettings = normalizeSettings(object(eventSettings)?.["caddyfile"] ?? eventSettings);
    }
    for (const document of documents.all()) void publish(document);
  });

  connection.onNotification("caddyfile/workspaceFiles", (payload: unknown): void => {
    const value = object(payload);
    const files = value?.["files"];
    const roots = value?.["roots"];
    workspaceRoots = Array.isArray(roots)
      ? roots.filter((root): root is string => typeof root === "string").slice(0, 100)
      : [];
    workspaceIndex.replace(Array.isArray(files) ? files : []);
    for (const document of documents.all()) void publish(document);
  });

  connection.onCompletion((params): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return [];
    const offset = document.offsetAt(params.position);
    if (!isLanguageOffset(document, offset)) return [];
    return completionsAt(tree, offset).map((item): CompletionItem => ({
      ...(item.deprecated === true ? { tags: [1] } : {}),
      detail: item.detail,
      documentation: { kind: MarkupKind.Markdown, value: item.documentation },
      ...(item.insertText === undefined ? {} : { insertText: item.insertText }),
      kind: item.kind === "value" ? CompletionItemKind.Value : CompletionItemKind.Keyword,
      label: item.label,
    }));
  });

  connection.onHover((params): Hover | undefined => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return undefined;
    const hover = hoverAt(tree, document.offsetAt(params.position));
    return hover === undefined
      ? undefined
      : {
          contents: { kind: MarkupKind.Markdown, value: hover.markdown },
          range: toRange(document, hover.span),
        };
  });

  connection.onSignatureHelp((params): SignatureHelp | undefined => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return undefined;
    const offset = document.offsetAt(params.position);
    const statement = deepestStatementAt(tree, offset);
    if (statement === undefined) return undefined;
    const item = languageItemAt(tree, offset);
    if (item === undefined) return undefined;
    const parameters = [...item.syntax.matchAll(/<[^>]+>/gu)].map((match) => ({
      label: match[0],
    }));
    const activeParameter = Math.max(
      0,
      Math.min(
        parameters.length - 1,
        statement.tokens.filter(({ span }) => span.end <= offset).length - 2,
      ),
    );
    return {
      activeParameter,
      activeSignature: 0,
      signatures: [
        {
          activeParameter,
          documentation: { kind: MarkupKind.Markdown, value: item.summary },
          label: item.syntax,
          parameters,
        },
      ],
    };
  });

  connection.onDocumentFormatting((params): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    return document === undefined ? [] : fullDocumentFormat(document);
  });

  connection.onDocumentRangeFormatting((params): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];
    return rangeDocumentFormat(document, params.range);
  });

  connection.onDefinition((params): Location | undefined => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined || parsed(document) === undefined) return undefined;
    const definition = definitionAtWorkspace(
      document.uri,
      document.offsetAt(params.position),
      workspaceIndex.merged(documents.all()),
    );
    return definition === undefined
      ? undefined
      : {
          range: toRange(definition.document, definition.span),
          uri: definition.document.uri,
        };
  });

  connection.onReferences((params): Location[] => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined || parsed(document) === undefined) return [];
    const offset = document.offsetAt(params.position);
    return occurrencesAtWorkspace(document.uri, offset, workspaceIndex.merged(documents.all()))
      .filter(({ definition }) => params.context.includeDeclaration || !definition)
      .map((occurrence) => ({
        range: toRange(occurrence.document, occurrence.span),
        uri: occurrence.document.uri,
      }));
  });

  connection.onDocumentHighlight((params): DocumentHighlight[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return [];
    const offset = document.offsetAt(params.position);
    const definitionSpans = tree.definitions.map(({ span }) => span);
    return referencesAt(tree, offset).map((span) => ({
      kind: definitionSpans.includes(span)
        ? DocumentHighlightKind.Write
        : DocumentHighlightKind.Read,
      range: toRange(document, span),
    }));
  });

  connection.onPrepareRename((params): Range | undefined => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined || parsed(document) === undefined) return undefined;
    const offset = document.offsetAt(params.position);
    const occurrence = occurrencesAtWorkspace(
      document.uri,
      offset,
      workspaceIndex.merged(documents.all()),
    ).find(
      ({ document: candidate, span }) =>
        candidate.uri === document.uri && spanContains(span, offset),
    );
    return occurrence === undefined ? undefined : toRange(document, occurrence.span);
  });

  connection.onRenameRequest((params): WorkspaceEdit | undefined => {
    if (!/^[A-Za-z0-9_.-]+$/u.test(params.newName)) return undefined;
    const document = documents.get(params.textDocument.uri);
    if (document === undefined || parsed(document) === undefined) return undefined;
    const occurrences = occurrencesAtWorkspace(
      document.uri,
      document.offsetAt(params.position),
      workspaceIndex.merged(documents.all()),
    );
    if (occurrences.length === 0) return undefined;
    const changes: Record<string, TextEdit[]> = {};
    for (const occurrence of occurrences) {
      const edits = changes[occurrence.document.uri] ?? [];
      edits.push({
        newText: renamedText(
          occurrence.document.getText(toRange(occurrence.document, occurrence.span)),
          params.newName,
        ),
        range: toRange(occurrence.document, occurrence.span),
      });
      changes[occurrence.document.uri] = edits;
    }
    return {
      changes,
    };
  });

  connection.onDocumentSymbol((params): DocumentSymbol[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    return document === undefined || tree === undefined ? [] : documentSymbols(document, tree);
  });

  connection.onWorkspaceSymbol(({ query }): SymbolInformation[] => {
    const result: SymbolInformation[] = [];
    for (const { document, tree } of workspaceIndex.merged(documents.all()).values()) {
      for (const definition of tree.definitions) {
        if (!definition.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
        result.push({
          kind: symbolKindForDefinition(definition),
          location: { range: toRange(document, definition.span), uri: document.uri },
          name: definition.name,
        });
      }
    }
    return result;
  });

  connection.onFoldingRanges((params): FoldingRange[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return [];
    return tree.statements.flatMap((statement) => {
      if (!statement.opensBlock) return [];
      const range = toRange(document, statement.span);
      return range.end.line > range.start.line
        ? [
            {
              endLine: Math.max(range.start.line, range.end.line - 1),
              kind: FoldingRangeKind.Region,
              startLine: range.start.line,
            },
          ]
        : [];
    });
  });

  connection.onSelectionRanges((params): SelectionRange[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return [];
    return params.positions.map((position) => selectionRangeAt(document, tree, position));
  });

  connection.onDocumentLinks((params): DocumentLink[] => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    if (document === undefined || tree === undefined) return [];
    const indexed = workspaceIndex.merged(documents.all());
    return tree.references.flatMap((reference) => {
      if (reference.kind !== "import") return [];
      const targets = importTargets(document.uri, reference, indexed);
      if (targets.length > 0) {
        return targets.map(({ document: target }) => ({
          range: toRange(document, reference.span),
          target: target.uri,
          tooltip: "Open imported Caddyfile",
        }));
      }
      if (/[*?{}$]/u.test(reference.name)) return [];
      try {
        return [
          {
            range: toRange(document, reference.span),
            target: Utils.resolvePath(
              Utils.dirname(URI.parse(document.uri)),
              reference.name,
            ).toString(),
            tooltip: "Open imported Caddyfile",
          },
        ];
      } catch {
        return [];
      }
    });
  });

  connection.languages.semanticTokens.on((params): SemanticTokens => {
    const document = documents.get(params.textDocument.uri);
    const tree = document === undefined ? undefined : parsed(document);
    const builder = new SemanticTokensBuilder();
    if (document === undefined || tree === undefined) return builder.build();
    for (const semantic of nonOverlappingSemanticSpans(semanticSpans(tree))) {
      pushSemanticSpan(builder, document, semantic);
    }
    return builder.build();
  });

  connection.onCodeAction((params): CodeAction[] => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];
    return params.context.diagnostics.flatMap((diagnostic): CodeAction[] => {
      const code = String(diagnostic.code ?? "");
      if (code === "deprecated-item") {
        const item = languageItemFor(document.getText(diagnostic.range));
        if (item?.deprecated === undefined) return [];
        return [
          quickFix(
            document.uri,
            diagnostic,
            `Use ${item.deprecated.replacement}`,
            item.deprecated.replacement,
          ),
        ];
      }
      if (code === "missing-space-before-brace") {
        const text = document.getText(diagnostic.range);
        const brace = text.lastIndexOf("{");
        if (brace < 1) return [];
        const start = document.offsetAt(diagnostic.range.start) + brace;
        return [
          quickFixAt(document, diagnostic, "Insert space before brace", { end: start, start }, " "),
        ];
      }
      if (code === "unknown-directive" || code === "unknown-global-option") {
        const replacement = object(diagnostic.data)?.["replacement"];
        const kind = code === "unknown-directive" ? "directive" : "global-option";
        if (typeof replacement !== "string" || languageItemFor(replacement, [kind]) === undefined) {
          return [];
        }
        return [quickFix(document.uri, diagnostic, `Use ${replacement}`, replacement)];
      }
      return [];
    });
  });

  documents.onDidOpen(({ document }): void => {
    void publish(document);
  });
  documents.onDidChangeContent(({ document }): void => {
    void publish(document);
  });
  documents.onDidClose(({ document }): void => {
    settingsCache.delete(document.uri);
    void connection.sendDiagnostics({ diagnostics: [], uri: document.uri });
  });
  documents.listen(connection);
  connection.listen();
}

function normalizeSettings(candidate: unknown): ServerSettings {
  const root = object(candidate);
  const validation = object(root?.["validation"]);
  const diagnostics = object(root?.["diagnostics"]);
  const unknown = diagnostics?.["unknownItems"];
  return {
    diagnostics: {
      unknownItems: unknown === "off" || unknown === "warning" ? unknown : "hint",
    },
    validation: {
      enable: validation?.["enable"] !== false,
      maxProblems: boundedInteger(validation?.["maxProblems"], 1, 2000, 200),
    },
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function toDiagnostic(document: TextDocument, item: CoreDiagnostic): Diagnostic {
  return {
    code: item.code,
    ...(item.replacement === undefined ? {} : { data: { replacement: item.replacement } }),
    message: item.message,
    range: toRange(document, item.span),
    severity:
      item.severity === "error"
        ? DiagnosticSeverity.Error
        : item.severity === "warning"
          ? DiagnosticSeverity.Warning
          : DiagnosticSeverity.Hint,
    source: "Caddyfile",
    ...(item.code === "deprecated-item" ? { tags: [DiagnosticTag.Deprecated] } : {}),
  };
}

function fullDocumentFormat(document: TextDocument): TextEdit[] {
  const original = document.getText();
  if (document.languageId === "caddyfile-test") {
    const parts = splitCaddyfileTest(original);
    const formattedCaddyfile = formatCaddyfile(parts.caddyfile);
    return parts.caddyfile === formattedCaddyfile
      ? []
      : [
          {
            newText: formattedCaddyfile,
            range: toRange(document, { end: parts.delimiterOffset, start: 0 }),
          },
        ];
  }
  const formatted = formatCaddyfile(original);
  return original === formatted
    ? []
    : [{ newText: formatted, range: toRange(document, { end: original.length, start: 0 }) }];
}

function rangeDocumentFormat(document: TextDocument, requested: Range): TextEdit[] {
  const completeSource = document.getText();
  const parts =
    document.languageId === "caddyfile-test" ? splitCaddyfileTest(completeSource) : undefined;
  if (parts !== undefined && document.offsetAt(requested.start) >= parts.delimiterOffset) return [];
  const source = parts?.caddyfile ?? completeSource;
  const formatted = formatCaddyfile(source);
  if (source === formatted) return [];
  const sourceLines = source.split("\n");
  const formattedLines = formatted.split("\n");
  if (sourceLines.length !== formattedLines.length) return [];
  const startLine = requested.start.line;
  const endLine = requested.end.character === 0 ? requested.end.line : requested.end.line + 1;
  const start = document.offsetAt({ character: 0, line: startLine });
  const end = Math.min(
    document.offsetAt({ character: 0, line: endLine }),
    parts?.delimiterOffset ?? completeSource.length,
  );
  const original = source.slice(start, end);
  const replacement =
    formattedLines.slice(startLine, endLine).join("\n") +
    (end > start && source.slice(start, end).endsWith("\n") ? "\n" : "");
  return original === replacement
    ? []
    : [{ newText: replacement, range: toRange(document, { end, start }) }];
}

function languageSource(document: TextDocument): string {
  const text = document.getText();
  return document.languageId === "caddyfile-test" ? splitCaddyfileTest(text).caddyfile : text;
}

function isLanguageOffset(document: TextDocument, offset: number): boolean {
  return (
    document.languageId !== "caddyfile-test" ||
    offset < splitCaddyfileTest(document.getText()).delimiterOffset
  );
}

function toRange(document: TextDocument, span: TextSpan): Range {
  return { end: document.positionAt(span.end), start: document.positionAt(span.start) };
}

function deepestStatementAt(tree: ParsedDocument, offset: number): Statement | undefined {
  return tree.statements
    .filter(({ span }) => spanContains(span, offset))
    .sort((left, right) => right.depth - left.depth)[0];
}

function renamedText(original: string, name: string): string {
  if (original.startsWith("&(")) return `&(${name})`;
  if (original.startsWith("(")) return `(${name})`;
  if (original.startsWith("@")) return `@${name}`;
  return name;
}

function documentSymbols(document: TextDocument, tree: ParsedDocument): DocumentSymbol[] {
  const symbols = new Map<number, DocumentSymbol>();
  const roots: DocumentSymbol[] = [];
  tree.statements.forEach((statement, index) => {
    const symbol: DocumentSymbol = {
      children: [],
      detail: statement.kind.replace("-", " "),
      kind: symbolKindForStatement(statement),
      name: displayStatementName(statement),
      range: toRange(document, statement.span),
      selectionRange: toRange(document, statement.nameSpan),
    };
    symbols.set(index, symbol);
    const parent = statement.parent === undefined ? undefined : symbols.get(statement.parent);
    if (parent === undefined) roots.push(symbol);
    else parent.children?.push(symbol);
  });
  return roots;
}

function displayStatementName(statement: Statement): string {
  if (statement.kind === "global-options") return "Global options";
  if (statement.kind === "snippet") return statement.name.slice(1, -1);
  if (statement.kind === "named-route") return statement.name.slice(2, -1);
  if (statement.kind === "matcher") return statement.name.slice(1);
  return statement.name;
}

function symbolKindForStatement(statement: Statement): SymbolKind {
  if (statement.kind === "site") return SymbolKind.Namespace;
  if (statement.kind === "snippet" || statement.kind === "named-route") return SymbolKind.Function;
  if (statement.kind === "matcher") return SymbolKind.Variable;
  if (statement.kind === "global-options") return SymbolKind.Object;
  if (statement.kind === "global-option") return SymbolKind.Property;
  return SymbolKind.Method;
}

function symbolKindForDefinition(definition: SymbolDefinition): SymbolKind {
  return definition.kind === "matcher" ? SymbolKind.Variable : SymbolKind.Function;
}

function selectionRangeAt(
  document: TextDocument,
  tree: ParsedDocument,
  position: Position,
): SelectionRange {
  const offset = document.offsetAt(position);
  const token = tree.tokens.find(({ span }) => spanContains(span, offset));
  const statements = tree.statements
    .filter(({ span }) => spanContains(span, offset))
    .sort((left, right) => left.depth - right.depth);
  let parent: SelectionRange | undefined;
  for (const statement of statements) {
    parent = {
      ...(parent === undefined ? {} : { parent }),
      range: toRange(document, statement.span),
    };
  }
  return token === undefined
    ? (parent ?? { range: { end: position, start: position } })
    : {
        ...(parent === undefined ? {} : { parent }),
        range: toRange(document, token.span),
      };
}

function nonOverlappingSemanticSpans(spans: readonly SemanticSpan[]): readonly SemanticSpan[] {
  const boundaries = [...new Set(spans.flatMap(({ span }) => [span.start, span.end]))].sort(
    (left, right) => left - right,
  );
  const result: SemanticSpan[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === undefined || end === undefined || start === end) continue;
    const best = spans
      .filter(({ span }) => span.start <= start && span.end >= end)
      .sort((left, right) => semanticPriority(right.type) - semanticPriority(left.type))[0];
    if (best === undefined) continue;
    const previous = result.at(-1);
    if (
      previous?.type === best.type &&
      previous.deprecated === best.deprecated &&
      previous.span.end === start
    ) {
      result[result.length - 1] = {
        ...previous,
        span: { end, start: previous.span.start },
      };
    } else {
      result.push({
        ...(best.deprecated === undefined ? {} : { deprecated: best.deprecated }),
        span: { end, start },
        type: best.type,
      });
    }
  }
  return result;
}

function semanticPriority(type: SemanticSpan["type"]): number {
  if (type === "variable") return 6;
  if (type === "comment") return 5;
  if (type === "keyword" || type === "property") return 4;
  if (type === "string") return 3;
  return 2;
}

function pushSemanticSpan(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  semantic: SemanticSpan,
): void {
  const start = document.positionAt(semantic.span.start);
  const end = document.positionAt(semantic.span.end);
  const tokenType = tokenTypes.indexOf(semantic.type);
  const modifiers = semantic.deprecated === true ? 1 : 0;
  if (start.line === end.line) {
    if (end.character > start.character) {
      builder.push(
        start.line,
        start.character,
        end.character - start.character,
        tokenType,
        modifiers,
      );
    }
    return;
  }
  for (let line = start.line; line <= end.line; line++) {
    const lineStart = line === start.line ? start.character : 0;
    const lineEnd =
      line === end.line
        ? end.character
        : document.positionAt(document.offsetAt({ character: Number.MAX_SAFE_INTEGER, line }))
            .character;
    if (lineEnd > lineStart) {
      builder.push(line, lineStart, lineEnd - lineStart, tokenType, modifiers);
    }
  }
}

function quickFix(
  uri: string,
  diagnostic: Diagnostic,
  title: string,
  replacement: string,
): CodeAction {
  return {
    diagnostics: [diagnostic],
    edit: { changes: { [uri]: [{ newText: replacement, range: diagnostic.range }] } },
    isPreferred: true,
    kind: CodeActionKind.QuickFix,
    title,
  };
}

function quickFixAt(
  document: TextDocument,
  diagnostic: Diagnostic,
  title: string,
  span: TextSpan,
  replacement: string,
): CodeAction {
  return {
    diagnostics: [diagnostic],
    edit: {
      changes: {
        [document.uri]: [{ newText: replacement, range: toRange(document, span) }],
      },
    },
    isPreferred: true,
    kind: CodeActionKind.QuickFix,
    title,
  };
}
