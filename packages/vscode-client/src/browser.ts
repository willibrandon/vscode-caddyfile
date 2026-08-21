import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";
import {
  clientOptions,
  registerCommonCommands,
  registerWorkspaceSynchronization,
} from "./common.js";

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
  const refreshWorkspace = registerWorkspaceSynchronization(context, client, output);
  registerCommonCommands(context, client, output, refreshWorkspace);
  const unavailable = async (): Promise<void> => {
    await vscode.window.showInformationMessage(
      "Installed Caddy commands are unavailable in a browser extension host; built-in language features remain active.",
    );
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("caddyfile.checkWithCaddy", unavailable),
    vscode.commands.registerCommand("caddyfile.showAdaptedJson", unavailable),
    vscode.commands.registerCommand("caddyfile.showCaddyInformation", unavailable),
  );
  output.info("Caddyfile language server started in a Web Worker.");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  serverWorker?.terminate();
  client = undefined;
  serverWorker = undefined;
}
