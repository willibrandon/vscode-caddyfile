import { CADDY_LANGUAGE_DATA_VERSION } from "@caddyfile/language-core";
import { TextDocumentSyncKind, TextDocuments } from "vscode-languageserver";
import type { Connection, InitializeResult } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

export function startLanguageServer(connection: Connection): void {
  const documents = new TextDocuments(TextDocument);

  connection.onInitialize((): InitializeResult => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
    serverInfo: {
      name: "Caddyfile Language Server",
      version: CADDY_LANGUAGE_DATA_VERSION,
    },
  }));

  documents.listen(connection);
  connection.listen();
}
