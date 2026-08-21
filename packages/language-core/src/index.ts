export const CADDY_LANGUAGE_DATA_VERSION = "2.11.4";

export { analyzeCaddyfile } from "./analysis.js";
export { formatCaddyfile } from "./formatter.js";
export {
  allKnownNames,
  completionsAt,
  definitionAt,
  hoverAt,
  languageCoverage,
  referencesAt,
  semanticSpans,
} from "./intelligence.js";
export { tokenize } from "./lexer.js";
export { parseCaddyfile, spanContains } from "./parser.js";
export {
  allLanguageItems,
  directives,
  globalOptions,
  languageItemFor,
  languageItemsFor,
  matchers,
  subdirectives,
} from "./registry.js";
export type { AnalysisOptions } from "./analysis.js";
export type {
  CoreCompletion,
  CoreDiagnostic,
  CoreDiagnosticSeverity,
  CoreHover,
  LanguageItem,
  LanguageItemKind,
  ParsedDocument,
  SemanticSpan,
  SourcePosition,
  Statement,
  StatementKind,
  SymbolDefinition,
  SymbolReference,
  TextSpan,
  Token,
  TokenKind,
  TokenizationResult,
} from "./types.js";
