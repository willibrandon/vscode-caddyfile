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
  refreshWorkspace: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("caddyfile.restartLanguageServer", async (): Promise<void> => {
      output.info("Restarting Caddyfile language server.");
      await client.stop();
      await client.start();
      await refreshWorkspace();
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

export function registerWorkspaceSynchronization(
  context: vscode.ExtensionContext,
  client: BaseLanguageClient,
  output: vscode.LogOutputChannel,
): () => Promise<void> {
  const indexedUris = new Set<string>();
  let generation = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const refresh = async (): Promise<void> => {
    const currentGeneration = ++generation;
    const files = await workspaceFiles();
    if (currentGeneration !== generation) return;
    indexedUris.clear();
    for (const file of files) indexedUris.add(file.uri);
    await client.sendNotification("caddyfile/workspaceFiles", {
      files,
      roots: vscode.workspace.workspaceFolders?.map(({ uri }) => uri.toString()) ?? [],
    });
    output.debug(`Indexed ${files.length} Caddyfile workspace files.`);
  };
  const schedule = (): void => {
    if (debounce !== undefined) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = undefined;
      void refresh();
    }, 150);
  };
  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(schedule),
    watcher.onDidDelete(schedule),
    watcher.onDidChange((changed) => {
      if (indexedUris.has(changed.toString()) || isCaddyfileName(changed)) schedule();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (indexedUris.has(document.uri.toString()) || isCaddyfileName(document.uri)) schedule();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(schedule),
    {
      dispose(): void {
        generation++;
        if (debounce !== undefined) clearTimeout(debounce);
      },
    },
  );
  void refresh();
  return refresh;
}

async function workspaceFiles(): Promise<readonly WorkspaceFile[]> {
  const seeds = await vscode.workspace.findFiles(
    "**/{Caddyfile,Caddyfile.*,Caddyfile-*,*.Caddyfile,*.caddyfile,*.caddyfiletest}",
    "**/{.git,node_modules,.cache,dist,coverage}/**",
    2_000,
  );
  const pending = [...seeds];
  const seen = new Set<string>();
  const files: WorkspaceFile[] = [];
  let totalBytes = 0;
  while (pending.length > 0 && files.length < 2_000 && totalBytes < 16_777_216) {
    const uri = pending.shift();
    if (uri === undefined || seen.has(uri.toString())) continue;
    seen.add(uri.toString());
    const bytes = await readWorkspaceBytes(uri);
    if (bytes === undefined || bytes.byteLength > 1_048_576) continue;
    totalBytes += bytes.byteLength;
    if (totalBytes > 16_777_216) break;
    const text = new TextDecoder().decode(bytes);
    files.push({ text, uri: uri.toString() });
    for (const target of await importedFiles(uri, text)) {
      if (!seen.has(target.toString())) pending.push(target);
    }
  }
  return files.sort((left, right) => left.uri.localeCompare(right.uri));
}

async function importedFiles(source: vscode.Uri, text: string): Promise<readonly vscode.Uri[]> {
  const result = new Map<string, vscode.Uri>();
  const pattern = /^[\t ]*import[\t ]+(?:"([^"]+)"|`([^`]+)`|([^\s#]+))/gmu;
  for (const match of text.matchAll(pattern)) {
    const name = match[1] ?? match[2] ?? match[3];
    if (name === undefined || /[${}]/u.test(name)) continue;
    const directory = vscode.Uri.joinPath(source, "..");
    if (/[*?]/u.test(name) || name.includes("[")) {
      try {
        const matches = await vscode.workspace.findFiles(
          new vscode.RelativePattern(directory, name.replaceAll("\\", "/")),
          "**/{.git,node_modules,.cache,dist,coverage}/**",
          2_000,
        );
        for (const target of matches) {
          if (vscode.workspace.getWorkspaceFolder(target) !== undefined) {
            result.set(target.toString(), target);
          }
        }
      } catch {
        // Invalid import globs are diagnosed by Caddy and the language server.
      }
      continue;
    }
    try {
      const target = vscode.Uri.joinPath(directory, name.replaceAll("\\", "/"));
      if (vscode.workspace.getWorkspaceFolder(target) === undefined) continue;
      if ((await vscode.workspace.fs.stat(target)).type === vscode.FileType.File) {
        result.set(target.toString(), target);
      }
    } catch {
      // A snippet name or missing file is not part of the workspace snapshot.
    }
  }
  return [...result.values()];
}

async function readWorkspaceBytes(uri: vscode.Uri): Promise<Uint8Array | undefined> {
  try {
    return await vscode.workspace.fs.readFile(uri);
  } catch {
    return undefined;
  }
}

function isCaddyfileName(uri: vscode.Uri): boolean {
  const name = uri.path.split("/").at(-1) ?? "";
  return (
    name === "Caddyfile" ||
    name.startsWith("Caddyfile.") ||
    name.startsWith("Caddyfile-") ||
    name.endsWith(".Caddyfile") ||
    name.endsWith(".caddyfile") ||
    name.endsWith(".caddyfiletest")
  );
}

interface WorkspaceFile {
  readonly text: string;
  readonly uri: string;
}
