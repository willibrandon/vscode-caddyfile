const assert = require("node:assert/strict");
const { TextDecoder } = require("node:util");
const vscode = require("vscode");

const extensionId = "willibrandon.caddyfile";

exports.run = async function run() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  assert.ok(root, "The fixture workspace must be open.");
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, extensionId + " must be installed.");
  const ignoreUri = vscode.Uri.joinPath(root, ".gitignore");
  const ignoredDirectory = vscode.Uri.joinPath(root, "artifacts");
  const ignoredUri = vscode.Uri.joinPath(ignoredDirectory, "ignored.caddyfile");
  await vscode.workspace.fs.createDirectory(ignoredDirectory);
  await vscode.workspace.fs.writeFile(ignoreUri, new TextEncoder().encode("artifacts/\n"));
  await vscode.workspace.fs.writeFile(
    ignoredUri,
    new TextEncoder().encode("(IgnoredAmbientMarker) {\n\trespond ignored\n}\n"),
  );
  const vscodeExcludedDirectory = vscode.Uri.joinPath(root, "excluded-by-vscode");
  const vscodeExcludedUri = vscode.Uri.joinPath(vscodeExcludedDirectory, "excluded.caddyfile");
  await vscode.workspace.fs.createDirectory(vscodeExcludedDirectory);
  await vscode.workspace.fs.writeFile(
    vscodeExcludedUri,
    new TextEncoder().encode("(VsCodeExcludedMarker) {\n\trespond excluded\n}\n"),
  );
  const filesConfiguration = vscode.workspace.getConfiguration("files", vscodeExcludedUri);
  await filesConfiguration.update(
    "exclude",
    { "**/excluded-by-vscode": true },
    vscode.ConfigurationTarget.Workspace,
  );
  const uri = vscode.Uri.joinPath(root, "Caddyfile");
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "caddyfile");
  await extension.activate();
  assert.equal(extension.isActive, true);

  const installedPathPrefix = process.env.CADDYFILE_EXPECTED_INSTALLED_EXTENSION_PATH_PREFIX;
  if (installedPathPrefix !== undefined) {
    assert.equal(
      extension.packageJSON.version,
      process.env.CADDYFILE_EXPECTED_INSTALLED_EXTENSION_VERSION,
    );
    assert.ok(extension.extensionPath.startsWith(installedPathPrefix));
  }

  // The server only learns about parts.caddy from the client's workspace snapshot, so this proves
  // the initial scan has landed before any watcher-driven refresh is expected.
  await waitFor(
    () => vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", "shared"),
    (items) => items.some((symbol) => symbol.location.uri.toString().endsWith("/parts.caddy")),
    "initial Caddyfile workspace index",
  );
  // VS Code starts its recursive workspace watcher after the window restores, and macOS FSEvents
  // subscriptions add their own delay, so a write made right after activation can go unobserved.
  // Every later step relies on watcher events, so keep rewriting a sentinel until the index shows
  // the newest write. Only a refresh scheduled by a watcher event can pick that content up.
  const visibleAfterActivationUri = vscode.Uri.joinPath(root, "visible-after-activation.caddyfile");
  let watcherAttempt = 0;
  await waitFor(
    async () => {
      watcherAttempt += 1;
      await vscode.workspace.fs.writeFile(
        visibleAfterActivationUri,
        new TextEncoder().encode(
          `(VisibleAfterActivationMarker${watcherAttempt}) {\n\trespond visible\n}\n`,
        ),
      );
      await delay(500);
      return vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "VisibleAfterActivationMarker",
      );
    },
    (items) =>
      items.some(
        (symbol) =>
          symbol.name === `VisibleAfterActivationMarker${watcherAttempt}` &&
          symbol.location.uri.toString() === visibleAfterActivationUri.toString(),
      ),
    "file watcher events to reach the extension",
    30_000,
  );
  let ignoredSymbols = await vscode.commands.executeCommand(
    "vscode.executeWorkspaceSymbolProvider",
    "IgnoredAmbientMarker",
  );
  assert.equal(
    ignoredSymbols.some((symbol) => symbol.location.uri.toString() === ignoredUri.toString()),
    false,
    "Git-ignored Caddyfiles must stay out of ambient workspace indexing.",
  );
  let vscodeExcludedSymbols = await vscode.commands.executeCommand(
    "vscode.executeWorkspaceSymbolProvider",
    "VsCodeExcludedMarker",
  );
  assert.equal(
    vscodeExcludedSymbols.some(
      (symbol) => symbol.location.uri.toString() === vscodeExcludedUri.toString(),
    ),
    false,
    "files.exclude entries must stay out of ambient workspace indexing.",
  );

  await vscode.workspace.fs.writeFile(ignoreUri, new TextEncoder().encode(""));
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "IgnoredAmbientMarker",
      ),
    (items) => items.some((symbol) => symbol.location.uri.toString() === ignoredUri.toString()),
    "Caddyfile to enter the index after .gitignore changes",
  );
  await vscode.workspace.fs.writeFile(ignoreUri, new TextEncoder().encode("artifacts/\n"));
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "IgnoredAmbientMarker",
      ),
    (items) => items.every((symbol) => symbol.location.uri.toString() !== ignoredUri.toString()),
    "Caddyfile to leave the index after .gitignore changes",
  );

  const indexConfiguration = vscode.workspace.getConfiguration("caddyfile", ignoredUri);
  await indexConfiguration.update(
    "index.useIgnoreFiles",
    false,
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "IgnoredAmbientMarker",
      ),
    (items) => items.some((symbol) => symbol.location.uri.toString() === ignoredUri.toString()),
    "ignored Caddyfile to enter the index when Git ignore filtering is disabled",
  );
  await indexConfiguration.update(
    "index.useIgnoreFiles",
    true,
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "IgnoredAmbientMarker",
      ),
    (items) => items.every((symbol) => symbol.location.uri.toString() !== ignoredUri.toString()),
    "ignored Caddyfile to leave the index when Git ignore filtering is restored",
  );

  await filesConfiguration.update(
    "exclude",
    { "**/excluded-by-vscode": false },
    vscode.ConfigurationTarget.Workspace,
  );
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "VsCodeExcludedMarker",
      ),
    (items) =>
      items.some((symbol) => symbol.location.uri.toString() === vscodeExcludedUri.toString()),
    "Caddyfile to enter the index after files.exclude changes",
  );
  await filesConfiguration.update(
    "exclude",
    { "**/excluded-by-vscode": true },
    vscode.ConfigurationTarget.Workspace,
  );
  await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        "VsCodeExcludedMarker",
      ),
    (items) =>
      items.every((symbol) => symbol.location.uri.toString() !== vscodeExcludedUri.toString()),
    "Caddyfile to leave the index after files.exclude changes",
  );

  const explicitUri = vscode.Uri.joinPath(root, "explicit-import.caddyfile");
  await vscode.workspace.fs.writeFile(
    explicitUri,
    new TextEncoder().encode(
      "import ./artifacts/ignored.caddyfile\n:9090 {\n\timport IgnoredAmbientMarker\n}\n",
    ),
  );
  const explicitDocument = await vscode.workspace.openTextDocument(explicitUri);
  await vscode.window.showTextDocument(explicitDocument);
  const ignoredDefinition = await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeDefinitionProvider",
        explicitUri,
        new vscode.Position(2, "\timport IgnoredAmbient".length),
      ),
    (locations) => locations[0]?.uri.toString() === ignoredUri.toString(),
    "explicit import to retain its Git-ignored target",
  );
  assert.equal(ignoredDefinition[0]?.uri.toString(), ignoredUri.toString());

  const completion = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    uri,
    new vscode.Position(6, 5),
  );
  assert.ok(completion.items.some((item) => item.label === "reverse_proxy"));

  const diagnostics = await waitFor(
    () => vscode.languages.getDiagnostics(uri),
    (items) => items.some((item) => diagnosticCode(item) === "unknown-directive"),
    "unknown directive diagnostic",
  );
  assert.ok(diagnostics.some((item) => item.source === "Caddyfile"));

  const hovers = await vscode.commands.executeCommand(
    "vscode.executeHoverProvider",
    uri,
    new vscode.Position(6, 5),
  );
  const hoverText = hovers
    .flatMap(({ contents }) => contents)
    .map((content) => (typeof content === "string" ? content : content.value))
    .join("\n");
  assert.match(hoverText, /Proxy requests to one or more upstream servers/u);

  const imported = await waitFor(
    () =>
      vscode.commands.executeCommand(
        "vscode.executeDefinitionProvider",
        uri,
        new vscode.Position(8, 10),
      ),
    (locations) =>
      locations[0]?.uri.toString() === vscode.Uri.joinPath(root, "parts.caddy").toString(),
    "imported snippet definition",
  );
  assert.equal(imported.length, 1);

  const routePosition = new vscode.Position(9, "\tinvoke back".length);
  const routeDefinition = await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    uri,
    routePosition,
  );
  assert.equal(
    routeDefinition[0]?.uri.toString(),
    vscode.Uri.joinPath(root, "parts.caddy").toString(),
  );

  const symbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri);
  assert.ok(symbols.some((symbol) => symbol.name === "example.com"));

  const unformattedUri = vscode.Uri.joinPath(root, "unformatted.caddyfile");
  await vscode.workspace.fs.writeFile(
    unformattedUri,
    new TextEncoder().encode("example.test {\n  respond ok\n}\n"),
  );
  const unformatted = await vscode.workspace.openTextDocument(unformattedUri);
  const edits = await vscode.commands.executeCommand(
    "vscode.executeFormatDocumentProvider",
    unformattedUri,
    { insertSpaces: true, tabSize: 2 },
  );
  const formatted = applyEdits(unformatted, edits);
  assert.equal(formatted, "example.test {\n\trespond ok\n}\n");
  assert.equal(
    new TextDecoder().decode(await vscode.workspace.fs.readFile(unformattedUri)),
    "example.test {\n  respond ok\n}\n",
    "formatting must return edits without changing the file on disk",
  );

  for (const [name, expectedLanguage] of [
    ["Caddyfile.production", "caddyfile"],
    ["custom.Caddyfile", "caddyfile"],
    ["fragment.caddyfile", "caddyfile"],
    ["sample.caddyfiletest", "caddyfile-test"],
  ]) {
    const configured = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, name));
    assert.equal(configured.languageId, expectedLanguage, name);
  }

  const adapterTestUri = vscode.Uri.joinPath(root, "sample.caddyfiletest");
  const adapterTest = await vscode.workspace.openTextDocument(adapterTestUri);
  const jsonCompletion = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    adapterTestUri,
    new vscode.Position(5, 8),
  );
  assert.ok(
    jsonCompletion.items.every(
      (item) =>
        !String(item.documentation?.value ?? item.documentation ?? "").includes(
          "Official documentation",
        ),
    ),
    "adapter JSON must not receive Caddy completions",
  );
  const adapterEdits = await vscode.commands.executeCommand(
    "vscode.executeFormatDocumentProvider",
    adapterTestUri,
    { insertSpaces: true, tabSize: 2 },
  );
  assert.equal(
    applyEdits(adapterTest, adapterEdits),
    'example.com {\n\trespond ok\n}\n----------\n{\n  "reverse_proxy": "not Caddyfile syntax",\n  "import": "./escape.caddy"\n}\n',
    "formatting must preserve adapter JSON byte for byte",
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    vscode.languages.getDiagnostics(adapterTestUri).length,
    0,
    "adapter JSON must not produce Caddyfile diagnostics",
  );

  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    "caddyfile.checkWithCaddy",
    "caddyfile.showAdaptedJson",
    "caddyfile.showCaddyInformation",
    "caddyfile.restartLanguageServer",
    "caddyfile.openDocumentation",
    "caddyfile.showOutput",
  ]) {
    assert.ok(commands.includes(command), command + " must be registered.");
  }

  await vscode.commands.executeCommand("caddyfile.restartLanguageServer");
  const restartedCompletion = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    uri,
    new vscode.Position(6, 5),
  );
  assert.ok(
    restartedCompletion.items.some((item) => item.label === "reverse_proxy"),
    "language features must return after a server restart",
  );

  const nodePath = process.env.CADDYFILE_TEST_NODE_PATH;
  assert.ok(nodePath, "The integration test Node.js path is required.");
  const fakeCaddy =
    "let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>process.stdout.write(JSON.stringify({received:input.length})))";
  await vscode.workspace
    .getConfiguration("caddyfile", uri)
    .update(
      "caddy.command",
      [nodePath, "-e", fakeCaddy, "--"],
      vscode.ConfigurationTarget.Workspace,
    );
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("caddyfile.showAdaptedJson");
  const adapted = vscode.window.activeTextEditor?.document;
  assert.ok(adapted, "Show Adapted JSON must open a document.");
  assert.equal(adapted.languageId, "json");
  assert.deepEqual(JSON.parse(adapted.getText()), { received: document.getText().length });
};

function applyEdits(document, edits) {
  return [...edits]
    .sort(
      (left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start),
    )
    .reduce((text, edit) => {
      const start = document.offsetAt(edit.range.start);
      const end = document.offsetAt(edit.range.end);
      return text.slice(0, start) + edit.newText + text.slice(end);
    }, document.getText());
}

function diagnosticCode(diagnostic) {
  return typeof diagnostic.code === "object" ? diagnostic.code.value : diagnostic.code;
}

async function waitFor(read, accept, description, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (await accept(value)) return value;
    await delay(50);
  }
  assert.fail("Timed out waiting for " + description + ".");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
