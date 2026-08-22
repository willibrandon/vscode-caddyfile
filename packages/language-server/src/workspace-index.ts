import { parseCaddyfile, spanContains, splitCaddyfileTest } from "@caddyfile/language-core";
import type {
  ParsedDocument,
  SymbolDefinition,
  SymbolReference,
  TextSpan,
} from "@caddyfile/language-core";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI, Utils } from "vscode-uri";

const maximumFiles = 2_000;
const maximumFileLength = 1_048_576;
const maximumSnapshotLength = 16_777_216;

export interface WorkspaceSnapshotFile {
  readonly text: string;
  readonly uri: string;
}

export interface IndexedDocument {
  readonly document: TextDocument;
  readonly tree: ParsedDocument;
}

export interface WorkspaceOccurrence {
  readonly definition: boolean;
  readonly document: TextDocument;
  readonly span: TextSpan;
}

export interface WorkspaceImportDiagnostic {
  readonly code: "import-cycle" | "unresolved-import";
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly span: TextSpan;
}

interface SymbolIdentity {
  readonly kind: SymbolDefinition["kind"];
  readonly name: string;
}

export class WorkspaceIndex {
  readonly #snapshot = new Map<string, IndexedDocument>();
  #ready = false;

  get ready(): boolean {
    return this.#ready;
  }

  replace(files: readonly WorkspaceSnapshotFile[]): void {
    const next = new Map<string, IndexedDocument>();
    let totalLength = 0;
    for (const file of files.slice(0, maximumFiles)) {
      if (!validFile(file) || file.text.length > maximumFileLength) continue;
      totalLength += file.text.length;
      if (totalLength > maximumSnapshotLength) break;
      const languageId = languageIdForUri(file.uri);
      const document = TextDocument.create(file.uri, languageId, 0, file.text);
      next.set(file.uri, { document, tree: parseCaddyfile(languageSource(document)) });
    }
    this.#snapshot.clear();
    for (const [uri, entry] of next) this.#snapshot.set(uri, entry);
    this.#ready = true;
  }

  merged(openDocuments: readonly TextDocument[]): ReadonlyMap<string, IndexedDocument> {
    const result = new Map(this.#snapshot);
    for (const document of openDocuments) {
      result.set(document.uri, { document, tree: parseCaddyfile(languageSource(document)) });
    }
    return result;
  }
}

function languageIdForUri(uri: string): "caddyfile" | "caddyfile-test" {
  try {
    return URI.parse(uri).path.toLocaleLowerCase().endsWith(".caddyfiletest")
      ? "caddyfile-test"
      : "caddyfile";
  } catch {
    return "caddyfile";
  }
}

function languageSource(document: TextDocument): string {
  const text = document.getText();
  return document.languageId === "caddyfile-test" ? splitCaddyfileTest(text).caddyfile : text;
}

export function definitionAtWorkspace(
  uri: string,
  offset: number,
  documents: ReadonlyMap<string, IndexedDocument>,
): WorkspaceOccurrence | undefined {
  const current = documents.get(uri);
  if (current === undefined) return undefined;
  const reference = referenceAt(current.tree, offset);
  if (reference?.kind === "import") {
    const target = resolveImportTargets(uri, reference.name, documents)[0];
    if (target !== undefined) {
      return { definition: true, document: target.document, span: { end: 0, start: 0 } };
    }
  }
  const symbol = symbolAt(uri, offset, documents);
  return symbol === undefined
    ? undefined
    : occurrencesFor(uri, symbol, documents).find(({ definition }) => definition);
}

export function occurrencesAtWorkspace(
  uri: string,
  offset: number,
  documents: ReadonlyMap<string, IndexedDocument>,
): readonly WorkspaceOccurrence[] {
  const symbol = symbolAt(uri, offset, documents);
  return symbol === undefined ? [] : occurrencesFor(uri, symbol, documents);
}

export function importTargets(
  uri: string,
  reference: SymbolReference,
  documents: ReadonlyMap<string, IndexedDocument>,
): readonly IndexedDocument[] {
  return reference.kind === "import" ? resolveImportTargets(uri, reference.name, documents) : [];
}

export function workspaceImportDiagnostics(
  uri: string,
  documents: ReadonlyMap<string, IndexedDocument>,
  workspaceRoots: readonly string[] = [],
): readonly WorkspaceImportDiagnostic[] {
  const current = documents.get(uri);
  if (current === undefined) return [];
  const graph = importGraph(documents);
  return current.tree.references.flatMap((reference): WorkspaceImportDiagnostic[] => {
    if (reference.kind !== "import" || !looksLikeFileImport(reference.name)) return [];
    const targets = resolveImportTargets(uri, reference.name, documents);
    if (targets.length === 0 && importFallsWithinWorkspace(uri, reference.name, workspaceRoots)) {
      return [
        {
          code: "unresolved-import",
          message: `No workspace file matches '${reference.name}'.`,
          severity: "warning",
          span: reference.span,
        },
      ];
    }
    if (targets.some(({ document }) => reachable(document.uri, uri, graph, new Set()))) {
      return [
        {
          code: "import-cycle",
          message: `Importing '${reference.name}' creates an import cycle.`,
          severity: "error",
          span: reference.span,
        },
      ];
    }
    return [];
  });
}

function symbolAt(
  uri: string,
  offset: number,
  documents: ReadonlyMap<string, IndexedDocument>,
): SymbolIdentity | undefined {
  const current = documents.get(uri);
  if (current === undefined) return undefined;
  const definition = current.tree.definitions.find(({ span }) => spanContains(span, offset));
  if (definition !== undefined) return definition;
  const reference = referenceAt(current.tree, offset);
  if (reference === undefined) return undefined;
  if (reference.kind !== "import") return { kind: reference.kind, name: reference.name };
  if (resolveImportTargets(uri, reference.name, documents).length > 0) return undefined;
  const component = connectedDocuments(uri, documents);
  return [...component]
    .map((candidateUri) => documents.get(candidateUri))
    .filter((entry): entry is IndexedDocument => entry !== undefined)
    .flatMap(({ tree }) => tree.definitions)
    .find(({ kind, name }) => kind === "snippet" && name === reference.name);
}

function occurrencesFor(
  uri: string,
  symbol: SymbolIdentity,
  documents: ReadonlyMap<string, IndexedDocument>,
): readonly WorkspaceOccurrence[] {
  const uris = symbol.kind === "matcher" ? new Set([uri]) : connectedDocuments(uri, documents);
  const result: WorkspaceOccurrence[] = [];
  for (const candidateUri of [...uris].sort()) {
    const entry = documents.get(candidateUri);
    if (entry === undefined) continue;
    result.push(
      ...entry.tree.definitions
        .filter(({ kind, name }) => kind === symbol.kind && name === symbol.name)
        .map(({ span }) => ({ definition: true, document: entry.document, span })),
      ...entry.tree.references
        .filter(
          (reference) =>
            (reference.kind === symbol.kind && reference.name === symbol.name) ||
            (symbol.kind === "snippet" &&
              reference.kind === "import" &&
              reference.name === symbol.name &&
              resolveImportTargets(candidateUri, reference.name, documents).length === 0),
        )
        .map(({ span }) => ({ definition: false, document: entry.document, span })),
    );
  }
  return result;
}

function connectedDocuments(
  uri: string,
  documents: ReadonlyMap<string, IndexedDocument>,
): ReadonlySet<string> {
  const graph = importGraph(documents);
  const reverse = new Map<string, Set<string>>();
  for (const [source, targets] of graph) {
    for (const target of targets) {
      const sources = reverse.get(target) ?? new Set<string>();
      sources.add(source);
      reverse.set(target, sources);
    }
  }
  const result = new Set<string>();
  const pending = [uri];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || result.has(current)) continue;
    result.add(current);
    pending.push(...(graph.get(current) ?? []), ...(reverse.get(current) ?? []));
  }
  return result;
}

function importGraph(
  documents: ReadonlyMap<string, IndexedDocument>,
): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, Set<string>>();
  for (const [uri, entry] of documents) {
    const targets = new Set<string>();
    for (const reference of entry.tree.references) {
      for (const target of importTargets(uri, reference, documents)) {
        targets.add(target.document.uri);
      }
    }
    result.set(uri, targets);
  }
  return result;
}

function resolveImportTargets(
  sourceUri: string,
  name: string,
  documents: ReadonlyMap<string, IndexedDocument>,
): readonly IndexedDocument[] {
  if (/[${}]/u.test(name)) return [];
  let resolved: URI;
  try {
    resolved = Utils.resolvePath(Utils.dirname(URI.parse(sourceUri)), name.replaceAll("\\", "/"));
  } catch {
    return [];
  }
  const pattern = globPattern(
    resolved.path,
    resolved.scheme.toLocaleLowerCase() === "file" && /^\/[A-Za-z]:\//u.test(resolved.path),
  );
  const authority = resolved.authority.toLocaleLowerCase();
  const scheme = resolved.scheme.toLocaleLowerCase();
  return [...documents.values()]
    .filter(({ document }) => {
      const candidate = URI.parse(document.uri);
      return (
        candidate.scheme.toLocaleLowerCase() === scheme &&
        candidate.authority.toLocaleLowerCase() === authority &&
        pattern.test(candidate.path)
      );
    })
    .sort((left, right) => left.document.uri.localeCompare(right.document.uri));
}

function looksLikeFileImport(name: string): boolean {
  return (
    !/[${}]/u.test(name) &&
    (/^(?:\.{0,2}[\\/]|[\\/])/u.test(name) || /[\\/.*?]/u.test(name) || name.includes("["))
  );
}

function globPattern(path: string, caseInsensitive: boolean): RegExp {
  let expression = "^";
  for (let index = 0; index < path.length; index++) {
    const character = path[index];
    if (character === "*") expression += "[^/]*";
    else if (character === "?") expression += "[^/]";
    else if (character === "[") {
      const end = path.indexOf("]", index + 1);
      if (end < 0) expression += "\\[";
      else {
        const content = path.slice(index + 1, end).replaceAll("\\", "\\\\");
        expression += `[${content}]`;
        index = end;
      }
    } else expression += escapeExpression(character ?? "");
  }
  return new RegExp(expression + "$", caseInsensitive ? "iu" : "u");
}

function escapeExpression(value: string): string {
  return /[\\^$.*+?()[\]{}|]/u.test(value) ? `\\${value}` : value;
}

function reachable(
  source: string,
  target: string,
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  seen: Set<string>,
): boolean {
  if (source === target) return true;
  if (seen.has(source)) return false;
  seen.add(source);
  return [...(graph.get(source) ?? [])].some((next) => reachable(next, target, graph, seen));
}

function importFallsWithinWorkspace(
  sourceUri: string,
  name: string,
  workspaceRoots: readonly string[],
): boolean {
  if (!looksLikeFileImport(name)) return false;
  try {
    const target = Utils.resolvePath(
      Utils.dirname(URI.parse(sourceUri)),
      name.replaceAll("\\", "/"),
    );
    return workspaceRoots.some((rootUri) => {
      const root = URI.parse(rootUri);
      const rootPath = root.path.endsWith("/") ? root.path : root.path + "/";
      return (
        root.scheme.toLocaleLowerCase() === target.scheme.toLocaleLowerCase() &&
        root.authority.toLocaleLowerCase() === target.authority.toLocaleLowerCase() &&
        (target.path + "/").startsWith(rootPath)
      );
    });
  } catch {
    return false;
  }
}

function referenceAt(tree: ParsedDocument, offset: number): SymbolReference | undefined {
  return tree.references.find(({ span }) => spanContains(span, offset));
}

function validFile(value: unknown): value is WorkspaceSnapshotFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WorkspaceSnapshotFile>;
  return typeof candidate.text === "string" && typeof candidate.uri === "string";
}
