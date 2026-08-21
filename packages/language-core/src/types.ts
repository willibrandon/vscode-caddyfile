export interface TextSpan {
  readonly start: number;
  readonly end: number;
}

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly character: number;
}

export type TokenKind =
  "word" | "quoted" | "backtick" | "heredoc" | "open-brace" | "close-brace" | "comment" | "newline";

export interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly raw: string;
  readonly span: TextSpan;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export type CoreDiagnosticSeverity = "error" | "warning" | "hint";

export interface CoreDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: CoreDiagnosticSeverity;
  readonly span: TextSpan;
}

export interface TokenizationResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly CoreDiagnostic[];
}

export type StatementKind =
  | "global-options"
  | "global-option"
  | "site"
  | "snippet"
  | "named-route"
  | "matcher"
  | "directive"
  | "subdirective"
  | "import";

export interface Statement {
  readonly kind: StatementKind;
  readonly name: string;
  readonly nameSpan: TextSpan;
  readonly span: TextSpan;
  readonly depth: number;
  readonly tokens: readonly Token[];
  readonly parent: number | undefined;
  readonly opensBlock: boolean;
}

export interface SymbolDefinition {
  readonly kind: "snippet" | "matcher" | "named-route";
  readonly name: string;
  readonly span: TextSpan;
}

export interface SymbolReference {
  readonly kind: "snippet" | "matcher" | "named-route" | "import";
  readonly name: string;
  readonly span: TextSpan;
}

export interface ParsedDocument {
  readonly text: string;
  readonly tokens: readonly Token[];
  readonly statements: readonly Statement[];
  readonly diagnostics: readonly CoreDiagnostic[];
  readonly definitions: readonly SymbolDefinition[];
  readonly references: readonly SymbolReference[];
}

export type LanguageItemKind = "directive" | "global-option" | "matcher" | "subdirective";

export interface LanguageItem {
  readonly name: string;
  readonly kind: LanguageItemKind;
  readonly summary: string;
  readonly syntax: string;
  readonly url: string;
  readonly values?: readonly string[];
  readonly deprecated?: Readonly<{ readonly replacement: string; readonly message: string }>;
  readonly parents?: readonly string[];
}

export interface CoreCompletion {
  readonly label: string;
  readonly detail: string;
  readonly documentation: string;
  readonly insertText?: string;
  readonly deprecated?: boolean;
}

export interface CoreHover {
  readonly markdown: string;
  readonly span: TextSpan;
}

export interface SemanticSpan {
  readonly span: TextSpan;
  readonly type: "keyword" | "string" | "number" | "comment" | "variable" | "property";
  readonly deprecated?: boolean;
}
