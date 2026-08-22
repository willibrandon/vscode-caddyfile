const assert = require("node:assert/strict");
const vscode = require("vscode");

const extensionId = "willibrandon.caddyfile";

exports.run = async function run() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  assert.ok(root, "The fixture workspace must be open.");
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, extensionId + " must be installed.");
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

async function waitFor(read, accept, description) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (await accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("Timed out waiting for " + description + ".");
}
