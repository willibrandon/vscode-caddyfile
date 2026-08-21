import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type { ServerOptions } from "vscode-languageclient/node";
import { clientOptions, registerCommonCommands } from "./common.js";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Caddyfile Language Server", { log: true });
  const module = vscode.Uri.joinPath(context.extensionUri, "dist", "nodeServer.cjs").fsPath;
  const serverOptions: ServerOptions = { module, transport: TransportKind.ipc };
  client = new LanguageClient(
    "caddyfile",
    "Caddyfile Language Server",
    serverOptions,
    clientOptions(output),
  );
  context.subscriptions.push(output, client);
  await client.start();
  registerCommonCommands(context, client, output);
  output.info("Caddyfile language server started.");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
}
