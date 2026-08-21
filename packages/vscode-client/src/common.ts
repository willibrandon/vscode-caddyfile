import * as vscode from "vscode";
import type { BaseLanguageClient, LanguageClientOptions } from "vscode-languageclient";

export const CADDYFILE_LANGUAGE_IDS: readonly string[] = ["caddyfile", "caddyfile-test"];

export function clientOptions(output: vscode.LogOutputChannel): LanguageClientOptions {
  return {
    documentSelector: CADDYFILE_LANGUAGE_IDS.map((language) => ({ language })),
    markdown: { isTrusted: false },
    outputChannel: output,
    synchronize: { configurationSection: "caddyfile" },
  };
}

export function registerCommonCommands(
  context: vscode.ExtensionContext,
  client: BaseLanguageClient,
  output: vscode.LogOutputChannel,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("caddyfile.restartLanguageServer", async (): Promise<void> => {
      output.info("Restarting Caddyfile language server.");
      await client.stop();
      await client.start();
      output.info("Caddyfile language server restarted.");
    }),
    vscode.commands.registerCommand("caddyfile.showOutput", (): void => output.show(true)),
    vscode.commands.registerCommand("caddyfile.openDocumentation", async (): Promise<void> => {
      await vscode.env.openExternal(
        vscode.Uri.parse("https://willibrandon.github.io/vscode-caddyfile/"),
      );
    }),
  );
}
