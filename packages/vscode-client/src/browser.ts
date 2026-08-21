import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";
import { clientOptions, registerCommonCommands } from "./common.js";

let client: LanguageClient | undefined;
let serverWorker: Worker | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Caddyfile Language Server", { log: true });
  const server = vscode.Uri.joinPath(context.extensionUri, "dist", "browserServer.js");
  serverWorker = new Worker(server.toString(true), { name: "Caddyfile Language Server" });
  client = new LanguageClient(
    "caddyfile",
    "Caddyfile Language Server",
    serverWorker,
    clientOptions(output),
  );
  context.subscriptions.push(output, client);
  await client.start();
  registerCommonCommands(context, client, output);
  output.info("Caddyfile language server started in a Web Worker.");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  serverWorker?.terminate();
  client = undefined;
  serverWorker = undefined;
}
