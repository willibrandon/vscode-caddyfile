import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type { ServerOptions } from "vscode-languageclient/node";
import { caddyResultSummary, parseCaddyOutput, parseCaddyWarnings } from "./caddy-output.js";
import { runCaddy } from "./caddy-runner.js";
import type { CaddyRunResult } from "./caddy-runner.js";
import {
  clientOptions,
  registerCommonCommands,
  registerWorkspaceSynchronization,
} from "./common.js";

const adaptArguments = ["adapt", "--config", "-", "--adapter", "caddyfile"] as const;
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
  const languageClient = client;
  context.subscriptions.push(output, languageClient);
  await languageClient.start();
  const refreshWorkspace = registerWorkspaceSynchronization(context, languageClient, output);
  registerCommonCommands(context, languageClient, output, refreshWorkspace);

  const diagnostics = vscode.languages.createDiagnosticCollection("caddy-installed");
  const active = new Map<string, AbortController>();
  context.subscriptions.push(diagnostics, {
    dispose(): void {
      for (const controller of active.values()) controller.abort();
      active.clear();
    },
  });

  const clear = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    active.get(key)?.abort();
    active.delete(key);
    diagnostics.delete(document.uri);
  };

  const executeAdapt = async (
    document: vscode.TextDocument | undefined,
    explicit: boolean,
    pretty: boolean,
  ): Promise<CaddyRunResult | undefined> => {
    const unavailable = caddyUnavailable(document);
    if (unavailable !== undefined) {
      if (document !== undefined) clear(document);
      if (explicit) await vscode.window.showInformationMessage(unavailable);
      return undefined;
    }
    if (document === undefined) return undefined;
    const key = document.uri.toString();
    active.get(key)?.abort();
    const controller = new AbortController();
    const version = document.version;
    active.set(key, controller);
    try {
      output.info("Running Caddy adapt for " + document.uri.fsPath + ".");
      const result = await runCaddy(
        {
          arguments: pretty ? [...adaptArguments, "--pretty"] : adaptArguments,
          command: configuredCommand(document.uri),
          cwd: vscode.Uri.joinPath(document.uri, "..").fsPath,
          input: document.getText(),
        },
        controller.signal,
        () => vscode.workspace.isTrusted,
      );
      logResult(output, result);
      if (result.cancelled || active.get(key) !== controller || document.version !== version) {
        return undefined;
      }
      diagnostics.set(document.uri, diagnosticsFromResult(document, result));
      return result;
    } catch (error) {
      diagnostics.delete(document.uri);
      if (explicit && !controller.signal.aborted) {
        await vscode.window.showErrorMessage("Caddy failed: " + safeMessage(error));
      } else if (!controller.signal.aborted) {
        output.warn("Caddy check skipped: " + safeMessage(error));
      }
      return undefined;
    } finally {
      if (active.get(key) === controller) active.delete(key);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("caddyfile.checkWithCaddy", async (): Promise<void> => {
      const result = await executeAdapt(vscode.window.activeTextEditor?.document, true, false);
      if (result === undefined) return;
      if (successful(result)) {
        const warningCount = parseCaddyWarnings(result.stderr, 1).length;
        await vscode.window.showInformationMessage(
          warningCount === 0
            ? "Caddy accepted this configuration."
            : `Caddy accepted this configuration with ${String(warningCount)} warning${warningCount === 1 ? "" : "s"}.`,
        );
      } else {
        await vscode.window.showWarningMessage(caddyResultSummary(result, "Caddy adapt"));
      }
    }),
    vscode.commands.registerCommand("caddyfile.showAdaptedJson", async (): Promise<void> => {
      const result = await executeAdapt(vscode.window.activeTextEditor?.document, true, true);
      if (result === undefined) return;
      if (!successful(result)) {
        await vscode.window.showWarningMessage(caddyResultSummary(result, "Caddy adapt"));
        return;
      }
      const adapted = await vscode.workspace.openTextDocument({
        content: ensureFinalNewline(result.stdout),
        language: "json",
      });
      await vscode.window.showTextDocument(adapted, { preview: true });
    }),
    vscode.commands.registerCommand("caddyfile.showCaddyInformation", async (): Promise<void> => {
      if (!vscode.workspace.isTrusted) {
        await vscode.window.showInformationMessage("Trust this workspace before running Caddy.");
        return;
      }
      const scope = vscode.window.activeTextEditor?.document.uri;
      const cwd =
        scope === undefined
          ? (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath)
          : vscode.Uri.joinPath(scope, "..").fsPath;
      try {
        const result = await runCaddy(
          {
            arguments: ["version"],
            command: configuredCommand(scope),
            cwd,
          },
          new AbortController().signal,
          () => vscode.workspace.isTrusted,
        );
        logResult(output, result);
        if (successful(result)) {
          await vscode.window.showInformationMessage(
            ensureSingleLine(result.stdout || result.stderr || "Caddy version completed."),
          );
        } else {
          await vscode.window.showWarningMessage(caddyResultSummary(result, "Caddy version"));
        }
      } catch (error) {
        await vscode.window.showErrorMessage("Caddy failed: " + safeMessage(error));
      }
    }),
    vscode.workspace.onDidSaveTextDocument(async (document): Promise<void> => {
      if (
        document.languageId === "caddyfile" &&
        vscode.workspace
          .getConfiguration("caddyfile", document.uri)
          .get<boolean>("caddy.checkOnSave", false)
      ) {
        await executeAdapt(document, false, false);
      }
    }),
    vscode.workspace.onDidChangeTextDocument(({ document }): void => {
      if (document.languageId === "caddyfile") clear(document);
    }),
    vscode.workspace.onDidCloseTextDocument(clear),
    vscode.workspace.onDidChangeConfiguration((event): void => {
      if (event.affectsConfiguration("caddyfile.caddy")) {
        for (const controller of active.values()) controller.abort();
        active.clear();
        diagnostics.clear();
      }
    }),
  );
  output.info("Caddyfile language server started.");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
}

function configuredCommand(scope: vscode.Uri | undefined): readonly string[] {
  const candidate = vscode.workspace
    .getConfiguration("caddyfile", scope)
    .get<unknown>("caddy.command", ["caddy"]);
  if (
    !Array.isArray(candidate) ||
    candidate.length === 0 ||
    !candidate.every((entry): entry is string => typeof entry === "string")
  ) {
    throw new Error("caddyfile.caddy.command must be a non-empty array of strings.");
  }
  return candidate;
}

function caddyUnavailable(document: vscode.TextDocument | undefined): string | undefined {
  if (document?.languageId !== "caddyfile") {
    return "Open a Caddyfile first.";
  }
  if (!vscode.workspace.isTrusted) return "Trust this workspace before running Caddy.";
  if (document.uri.scheme !== "file" || document.isUntitled) {
    return "Caddy checks require a saved file so relative imports have a working directory.";
  }
  return undefined;
}

function diagnosticsFromResult(
  document: vscode.TextDocument,
  result: CaddyRunResult,
): vscode.Diagnostic[] {
  const parsed = successful(result)
    ? parseCaddyWarnings(result.stderr, document.lineCount)
    : parseCaddyOutput(result.stdout, result.stderr, document.lineCount);
  if (successful(result))
    return parsed.map((message) =>
      createDiagnostic(
        document,
        message.line,
        message.character,
        message.message,
        vscode.DiagnosticSeverity.Warning,
      ),
    );
  if (parsed.length === 0) {
    return [
      createDiagnostic(
        document,
        0,
        0,
        caddyResultSummary(result, "Caddy adapt"),
        vscode.DiagnosticSeverity.Warning,
      ),
    ];
  }
  return parsed.map((message) =>
    createDiagnostic(
      document,
      message.line,
      message.character,
      message.message,
      message.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Error,
    ),
  );
}

function createDiagnostic(
  document: vscode.TextDocument,
  line: number,
  character: number,
  message: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
  const text = document.lineAt(line).text;
  const start = Math.min(character, text.length);
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(line, start, line, Math.min(text.length, start + 1)),
    message,
    severity,
  );
  diagnostic.source = "Caddy";
  diagnostic.code = "CADDY";
  return diagnostic;
}

function successful(result: CaddyRunResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.truncated;
}

function logResult(output: vscode.LogOutputChannel, result: CaddyRunResult): void {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (stdout !== "") output.info(ensureSingleLine(stdout));
  if (stderr !== "") {
    if (successful(result)) output.warn(ensureSingleLine(stderr));
    else output.error(ensureSingleLine(stderr));
  }
}

function safeMessage(error: unknown): string {
  return ensureSingleLine(error instanceof Error ? error.message : String(error));
}

function ensureSingleLine(value: string): string {
  return value.replace(/[\r\n\0]+/gu, " ").slice(0, 500);
}

function ensureFinalNewline(value: string): string {
  return value.endsWith("\n") ? value : value + "\n";
}
