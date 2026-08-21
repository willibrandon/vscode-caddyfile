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
    expect(workspaceSymbols.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["common", "api", "assets"]),
    );

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
  });
});

async function open(client: MessageConnection, text: string): Promise<void> {
  await client.sendNotification("textDocument/didOpen", {
    textDocument: { languageId: "caddyfile", text, uri, version: 1 },
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
