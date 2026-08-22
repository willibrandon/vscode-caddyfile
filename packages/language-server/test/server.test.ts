import { PassThrough } from "node:stream";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";
import type { MessageConnection } from "vscode-jsonrpc/node";
import { createConnection } from "vscode-languageserver/node";
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
  InitializeResult,
  Location,
  SelectionRange,
  SemanticTokens,
  SignatureHelp,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startLanguageServer } from "../src/server.js";

const uri = "file:///workspace/Caddyfile";
const source = `{
	debug
}
(common) {
	encode zstd gzip
}
&(api) {
	respond "api"
}
example.com {
	# Serve assets locally.
	@assets path /assets/*
	basicauth {
		user hash
	}
	reverse_proxy localhost:3000 {
		header_up Host {upstream_hostport}
	}
	import ./parts.caddy
	import common
	invoke api
	custom_handler
	respond <<BODY
hello from heredoc
BODY
}
`;

describe("language server JSON-RPC contract", () => {
  let client: MessageConnection;
  let clientInput: PassThrough;
  let server: Connection;
  let serverInput: PassThrough;

  beforeEach(async () => {
    clientInput = new PassThrough();
    serverInput = new PassThrough();
    server = createConnection(
      new StreamMessageReader(serverInput),
      new StreamMessageWriter(clientInput),
    );
    startLanguageServer(server);
    client = createMessageConnection(
      new StreamMessageReader(clientInput),
      new StreamMessageWriter(serverInput),
    );
    client.listen();

    const initialization = await client.sendRequest<InitializeResult>("initialize", {
      capabilities: {},
      clientInfo: { name: "contract test" },
      processId: null,
      rootUri: "file:///workspace",
    });
    expect(initialization.serverInfo).toEqual({
      name: "Caddyfile Language Server",
      version: "2.11.4",
    });
    expect(initialization.capabilities).toMatchObject({
      completionProvider: { resolveProvider: false },
      documentFormattingProvider: true,
      hoverProvider: true,
      renameProvider: { prepareProvider: true },
      semanticTokensProvider: { full: true },
    });
    await client.sendNotification("initialized", {});
  });

  afterEach(async () => {
    await client.sendNotification("textDocument/didClose", { textDocument: { uri } });
    await client.sendRequest("shutdown");
    server.dispose();
    client.dispose();
    clientInput.destroy();
    serverInput.destroy();
  });

  it("serves editing, navigation, and structural features", async () => {
    const diagnosticsPromise = nextDiagnostics(client);
    await open(client, source);
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["deprecated-item", "unknown-directive"]),
    );

    const completion = await request<CompletionItem[]>(client, "textDocument/completion", {
      textDocument: { uri },
      position: positionOf(source, "reverse_proxy", 3),
    });
    const reverseProxy = completion.find(({ label }) => label === "reverse_proxy");
    expect(reverseProxy?.detail).toContain("reverse_proxy");
    expect(JSON.stringify(reverseProxy?.documentation)).toContain("Official documentation");

    const hover = await request<Hover | null>(client, "textDocument/hover", {
      textDocument: { uri },
      position: positionOf(source, "reverse_proxy", 3),
    });
    expect(JSON.stringify(hover)).toContain("Proxy requests to one or more upstream servers");

    const signature = await request<SignatureHelp | null>(client, "textDocument/signatureHelp", {
      textDocument: { uri },
      position: positionOf(source, "localhost:3000", 5),
    });
    expect(signature?.signatures[0]?.label).toContain("reverse_proxy");

    const symbols = await request<DocumentSymbol[]>(client, "textDocument/documentSymbol", {
      textDocument: { uri },
    });
    expect(symbols.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Global options", "common", "api", "example.com"]),
    );
    expect(symbols.find(({ name }) => name === "example.com")?.children?.length).toBeGreaterThan(0);

    const workspaceSymbols = await request<SymbolInformation[]>(client, "workspace/symbol", {
      query: "api",
    });
    expect(workspaceSymbols.map(({ name }) => name)).toEqual(["api"]);

    const folds = await request<FoldingRange[]>(client, "textDocument/foldingRange", {
      textDocument: { uri },
    });
    expect(folds.length).toBeGreaterThanOrEqual(6);

    const selections = await request<SelectionRange[]>(client, "textDocument/selectionRange", {
      textDocument: { uri },
      positions: [positionOf(source, "header_up", 3)],
    });
    expect(selections[0]?.parent?.parent).toBeDefined();

    const links = await request<DocumentLink[]>(client, "textDocument/documentLink", {
      textDocument: { uri },
    });
    expect(links).toMatchObject([
      {
        target: "file:///workspace/parts.caddy",
        tooltip: "Open imported Caddyfile",
      },
    ]);

    const tokens = await request<SemanticTokens>(client, "textDocument/semanticTokens/full", {
      textDocument: { uri },
    });
    expect(tokens.data.length).toBeGreaterThan(20);

    const routeReference = positionOf(source, "invoke api", 8);
    const definition = await request<Location | null>(client, "textDocument/definition", {
      textDocument: { uri },
      position: routeReference,
    });
    expect(definition?.range.start).toEqual(positionOf(source, "&(api)", 0));

    const references = await request<Location[]>(client, "textDocument/references", {
      context: { includeDeclaration: true },
      textDocument: { uri },
      position: routeReference,
    });
    expect(references).toHaveLength(2);

    const highlights = await request<DocumentHighlight[]>(
      client,
      "textDocument/documentHighlight",
      {
        textDocument: { uri },
        position: routeReference,
      },
    );
    expect(highlights).toHaveLength(2);

    const prepare = await request(client, "textDocument/prepareRename", {
      textDocument: { uri },
      position: routeReference,
    });
    expect(prepare).not.toBeNull();
    const rename = await request<WorkspaceEdit>(client, "textDocument/rename", {
      newName: "backend",
      textDocument: { uri },
      position: routeReference,
    });
    expect(rename.changes?.[uri]?.map(({ newText }) => newText)).toEqual(["&(backend)", "backend"]);

    const formatting = await request<TextEdit[]>(client, "textDocument/formatting", {
      options: { insertSpaces: true, tabSize: 2 },
      textDocument: { uri },
    });
    expect(formatting).toEqual([]);

    const rangeFormatting = await request<TextEdit[]>(client, "textDocument/rangeFormatting", {
      options: { insertSpaces: true, tabSize: 2 },
      range: {
        end: { character: 0, line: 17 },
        start: { character: 0, line: 15 },
      },
      textDocument: { uri },
    });
    expect(rangeFormatting).toEqual([]);

    const unformatted = source.replace("\treverse_proxy", "  reverse_proxy");
    await change(client, unformatted, 2);
    const edits = await request<TextEdit[]>(client, "textDocument/formatting", {
      options: { insertSpaces: true, tabSize: 2 },
      textDocument: { uri },
    });
    expect(edits).toHaveLength(1);
    expect(edits[0]?.newText).toBe(source);
  });

  it("returns safe quick fixes and respects diagnostic settings", async () => {
    const diagnosticsPromise = nextDiagnostics(client);
    await open(client, source);
    const diagnostics = await diagnosticsPromise;
    const actions = await request<CodeAction[]>(client, "textDocument/codeAction", {
      context: { diagnostics },
      range: diagnostics[0]?.range,
      textDocument: { uri },
    });
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isPreferred: true,
          kind: "quickfix",
          title: "Use basic_auth",
        }),
      ]),
    );

    const spellingDiagnostics = nextDiagnostics(client);
    await change(client, ":80 {\n\treverze_proxy localhost:3000\n}\n", 2);
    const spelling = await spellingDiagnostics;
    const misspelling = spelling.find(({ code }) => code === "unknown-directive");
    expect(misspelling?.data).toEqual({ replacement: "reverse_proxy" });
    const spellingActions = await request<CodeAction[]>(client, "textDocument/codeAction", {
      context: { diagnostics: misspelling === undefined ? [] : [misspelling] },
      range: misspelling?.range,
      textDocument: { uri },
    });
    expect(spellingActions).toMatchObject([
      {
        edit: { changes: { [uri]: [{ newText: "reverse_proxy" }] } },
        isPreferred: true,
        title: "Use reverse_proxy",
      },
    ]);

    const next = nextDiagnostics(client);
    await client.sendNotification("workspace/didChangeConfiguration", {
      settings: {
        caddyfile: {
          diagnostics: { unknownItems: "off" },
          validation: { enable: true, maxProblems: 10 },
        },
      },
    });
    expect((await next).map(({ code }) => code)).not.toContain("unknown-directive");

    const malformedDiagnostics = nextDiagnostics(client);
    await change(client, "example.com{\n\trespond ok\n", 2);
    const malformed = await malformedDiagnostics;
    const braceProblem = malformed.find(({ code }) => code === "missing-space-before-brace");
    expect(braceProblem).toBeDefined();
    const braceActions = await request<CodeAction[]>(client, "textDocument/codeAction", {
      context: { diagnostics: braceProblem === undefined ? [] : [braceProblem] },
      range: braceProblem?.range,
      textDocument: { uri },
    });
    expect(braceActions).toMatchObject([
      {
        edit: {
          changes: {
            [uri]: [{ newText: " " }],
          },
        },
        title: "Insert space before brace",
      },
    ]);
  });

  it("returns accepted values as value completions", async () => {
    const valueSource = "{\n\tauto_https dis\n}\n";
    await open(client, valueSource);
    const values = await request<CompletionItem[]>(client, "textDocument/completion", {
      textDocument: { uri },
      position: positionOf(valueSource, "dis", 3),
    });
    expect(values).toMatchObject([
      { detail: "Value for auto_https", kind: 12, label: "disable_certs" },
      { detail: "Value for auto_https", kind: 12, label: "disable_redirects" },
    ]);
    expect(JSON.stringify(values[0]?.documentation)).toContain(
      "Disable automatic certificate management.",
    );
  });

  it("returns neutral results for unopened documents and invalid renames", async () => {
    const missing = { textDocument: { uri: "file:///workspace/missing.Caddyfile" } };
    expect(
      await request(client, "textDocument/completion", {
        ...missing,
        position: { character: 0, line: 0 },
      }),
    ).toEqual([]);
    expect(
      await request(client, "textDocument/hover", {
        ...missing,
        position: { character: 0, line: 0 },
      }),
    ).toBeNull();
    expect(
      await request(client, "textDocument/signatureHelp", {
        ...missing,
        position: { character: 0, line: 0 },
      }),
    ).toBeNull();
    expect(
      await request(client, "textDocument/formatting", {
        ...missing,
        options: { insertSpaces: true, tabSize: 2 },
      }),
    ).toEqual([]);
    expect(
      await request(client, "textDocument/rangeFormatting", {
        ...missing,
        options: { insertSpaces: true, tabSize: 2 },
        range: {
          end: { character: 0, line: 1 },
          start: { character: 0, line: 0 },
        },
      }),
    ).toEqual([]);
    expect(
      await request(client, "textDocument/definition", {
        ...missing,
        position: { character: 0, line: 0 },
      }),
    ).toBeNull();
    expect(
      await request(client, "textDocument/references", {
        ...missing,
        context: { includeDeclaration: true },
        position: { character: 0, line: 0 },
      }),
    ).toEqual([]);
    expect(await request(client, "textDocument/documentSymbol", missing)).toEqual([]);
    expect(await request(client, "textDocument/foldingRange", missing)).toEqual([]);
    expect(await request(client, "textDocument/documentLink", missing)).toEqual([]);
    expect(await request(client, "textDocument/semanticTokens/full", missing)).toMatchObject({
      data: [],
    });

    await open(client, source);
    expect(
      await request(client, "textDocument/rename", {
        newName: "invalid name",
        position: positionOf(source, "invoke api", 8),
        textDocument: { uri },
      }),
    ).toBeNull();
  });

  it("indexes imports and navigates across closed workspace files", async () => {
    const workspaceSource = `import ./parts.caddy
import shared
:80 {
	invoke backend
}
`;
    const partsUri = "file:///workspace/parts.caddy";
    const partsSource = `(shared) {
	encode gzip
}
&(backend) {
	respond ok
}
`;
    await open(client, workspaceSource);
    await client.sendNotification("caddyfile/workspaceFiles", {
      files: [
        { text: workspaceSource, uri },
        { text: partsSource, uri: partsUri },
      ],
    });

    const importedFile = await request<Location | null>(client, "textDocument/definition", {
      textDocument: { uri },
      position: positionOf(workspaceSource, "./parts.caddy", 3),
    });
    expect(importedFile).toMatchObject({
      range: { end: { character: 0, line: 0 }, start: { character: 0, line: 0 } },
      uri: partsUri,
    });

    const snippet = await request<Location | null>(client, "textDocument/definition", {
      textDocument: { uri },
      position: positionOf(workspaceSource, "shared", 2),
    });
    expect(snippet).toMatchObject({ uri: partsUri });
    expect(snippet?.range.start).toEqual(positionOf(partsSource, "(shared)", 0));

    const routePosition = positionOf(workspaceSource, "backend", 2);
    const routeReferences = await request<Location[]>(client, "textDocument/references", {
      context: { includeDeclaration: true },
      textDocument: { uri },
      position: routePosition,
    });
    expect(routeReferences.map(({ uri: locationUri }) => locationUri)).toHaveLength(2);
    expect(routeReferences.map(({ uri: locationUri }) => locationUri)).toEqual(
      expect.arrayContaining([partsUri, uri]),
    );

    const rename = await request<WorkspaceEdit>(client, "textDocument/rename", {
      newName: "origin",
      textDocument: { uri },
      position: routePosition,
    });
    expect(rename.changes?.[partsUri]?.map(({ newText }) => newText)).toEqual(["&(origin)"]);
    expect(rename.changes?.[uri]?.map(({ newText }) => newText)).toEqual(["origin"]);

    const workspaceSymbols = await request<SymbolInformation[]>(client, "workspace/symbol", {
      query: "back",
    });
    expect(workspaceSymbols.map(({ name }) => name)).toEqual(["backend"]);

    const links = await request<DocumentLink[]>(client, "textDocument/documentLink", {
      textDocument: { uri },
    });
    expect(links[0]?.target).toBe(partsUri);
  });

  it("keeps adapter test JSON outside Caddyfile language features and formatting", async () => {
    const adapterTest = `:80 {
  respond ok
}
----------
{"import":"./escape.caddy","reverse_proxy":"not Caddyfile syntax"}
`;
    const diagnosticsPromise = nextDiagnostics(client);
    await open(client, adapterTest, "caddyfile-test");
    expect(await diagnosticsPromise).toEqual([]);

    const jsonPosition = positionOf(adapterTest, "reverse_proxy", 4);
    expect(
      await request<CompletionItem[]>(client, "textDocument/completion", {
        textDocument: { uri },
        position: jsonPosition,
      }),
    ).toEqual([]);
    expect(
      await request<Hover | null>(client, "textDocument/hover", {
        textDocument: { uri },
        position: jsonPosition,
      }),
    ).toBeNull();
    expect(
      await request<DocumentLink[]>(client, "textDocument/documentLink", {
        textDocument: { uri },
      }),
    ).toEqual([]);

    const formatting = await request<TextEdit[]>(client, "textDocument/formatting", {
      options: { insertSpaces: true, tabSize: 2 },
      textDocument: { uri },
    });
    expect(formatting).toEqual([
      {
        newText: ":80 {\n\trespond ok\n}\n",
        range: {
          end: { character: 0, line: 3 },
          start: { character: 0, line: 0 },
        },
      },
    ]);
    expect(applyEdits(adapterTest, formatting)).toBe(
      `:80 {
\trespond ok
}
----------
{"import":"./escape.caddy","reverse_proxy":"not Caddyfile syntax"}
`,
    );

    const rangeFormatting = await request<TextEdit[]>(client, "textDocument/rangeFormatting", {
      options: { insertSpaces: true, tabSize: 2 },
      range: {
        end: { character: 0, line: 5 },
        start: { character: 0, line: 0 },
      },
      textDocument: { uri },
    });
    expect(rangeFormatting[0]?.range.end).toEqual({ character: 0, line: 3 });
    expect(applyEdits(adapterTest, rangeFormatting).slice(adapterTest.indexOf("----------"))).toBe(
      adapterTest.slice(adapterTest.indexOf("----------")),
    );
  });
});

async function open(
  client: MessageConnection,
  text: string,
  languageId = "caddyfile",
): Promise<void> {
  await client.sendNotification("textDocument/didOpen", {
    textDocument: { languageId, text, uri, version: 1 },
  });
}

async function change(client: MessageConnection, text: string, version: number): Promise<void> {
  await client.sendNotification("textDocument/didChange", {
    contentChanges: [{ text }],
    textDocument: { uri, version },
  });
}

function nextDiagnostics(client: MessageConnection): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const disposable = client.onNotification(
      "textDocument/publishDiagnostics",
      (params: { readonly diagnostics: Diagnostic[] }): void => {
        disposable.dispose();
        resolve(params.diagnostics);
      },
    );
  });
}

async function request<T>(client: MessageConnection, method: string, params: unknown): Promise<T> {
  return client.sendRequest<T>(method, params);
}

function applyEdits(text: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((left, right) => offsetAt(text, right.range.start) - offsetAt(text, left.range.start))
    .reduce((current, edit) => {
      const start = offsetAt(current, edit.range.start);
      const end = offsetAt(current, edit.range.end);
      return current.slice(0, start) + edit.newText + current.slice(end);
    }, text);
}

function offsetAt(
  text: string,
  position: { readonly character: number; readonly line: number },
): number {
  const lines = text.split("\n");
  return (
    lines.slice(0, position.line).reduce((length, line) => length + line.length + 1, 0) +
    position.character
  );
}

function positionOf(
  text: string,
  needle: string,
  relativeCharacter: number,
): {
  readonly character: number;
  readonly line: number;
} {
  const offset = text.indexOf(needle) + relativeCharacter;
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  const newline = before.lastIndexOf("\n");
  return { character: offset - newline - 1, line };
}
