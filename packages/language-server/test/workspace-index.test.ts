import { describe, expect, it } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  WorkspaceIndex,
  definitionAtWorkspace,
  importEditsForFileRenames,
  importTargets,
  occurrencesAtWorkspace,
  referencesAtWorkspace,
  workspaceImportDiagnostics,
} from "../src/workspace-index.js";

const mainUri = "file:///workspace/Caddyfile";
const partsUri = "file:///workspace/parts.caddy";

describe("workspace index", () => {
  it("resolves files, snippets, named routes, and wildcard imports", () => {
    const main = `import ./parts.caddy
import ./sites/*.caddy
import common
:80 {
	invoke backend
}
`;
    const parts = `(common) {
	encode gzip
}
&(backend) {
	respond ok
}
`;
    const index = new WorkspaceIndex();
    index.replace([
      { text: main, uri: mainUri },
      { text: parts, uri: partsUri },
      { text: "one.example { respond one }\n", uri: "file:///workspace/sites/one.caddy" },
      { text: "two.example { respond two }\n", uri: "file:///workspace/sites/two.caddy" },
    ]);
    const documents = index.merged([TextDocument.create(mainUri, "caddyfile", 3, main)]);
    const mainEntry = documents.get(mainUri);
    expect(index.ready).toBe(true);
    expect(mainEntry).toBeDefined();
    const fileReference = mainEntry?.tree.references.find(({ name }) => name === "./parts.caddy");
    const wildcardReference = mainEntry?.tree.references.find(
      ({ name }) => name === "./sites/*.caddy",
    );
    expect(
      fileReference === undefined ? [] : importTargets(mainUri, fileReference, documents),
    ).toMatchObject([{ document: { uri: partsUri } }]);
    expect(
      wildcardReference === undefined ? [] : importTargets(mainUri, wildcardReference, documents),
    ).toHaveLength(2);

    const importedDefinition = definitionAtWorkspace(
      mainUri,
      main.indexOf("./parts.caddy") + 2,
      documents,
    );
    expect(importedDefinition).toMatchObject({
      document: { uri: partsUri },
      span: { end: 0, start: 0 },
    });
    const snippetDefinition = definitionAtWorkspace(mainUri, main.indexOf("common") + 2, documents);
    expect(snippetDefinition).toMatchObject({ definition: true, document: { uri: partsUri } });

    const routeOccurrences = occurrencesAtWorkspace(
      mainUri,
      main.indexOf("backend") + 2,
      documents,
    );
    expect(routeOccurrences.map(({ definition, document }) => [document.uri, definition])).toEqual([
      [mainUri, false],
      [partsUri, true],
    ]);
  });

  it("keeps matcher names local to their document", () => {
    const first = ":80 {\n @api path /api/*\n handle @api { respond ok }\n}\n";
    const second = ":81 {\n @api path /other/*\n handle @api { respond ok }\n}\n";
    const index = new WorkspaceIndex();
    index.replace([
      { text: first, uri: mainUri },
      { text: second, uri: partsUri },
    ]);
    const occurrences = occurrencesAtWorkspace(
      mainUri,
      first.lastIndexOf("@api") + 2,
      index.merged([]),
    );
    expect(occurrences).toHaveLength(2);
    expect(occurrences.every(({ document }) => document.uri === mainUri)).toBe(true);
  });

  it("finds every import reference that resolves to the same file", () => {
    const nestedUri = "file:///workspace/sites/Caddyfile";
    const index = new WorkspaceIndex();
    index.replace([
      { text: "import ./parts.caddy\n", uri: mainUri },
      { text: "respond ok\n", uri: partsUri },
      { text: "import ../parts.caddy\n", uri: nestedUri },
    ]);
    const references = referencesAtWorkspace(
      mainUri,
      "import ./parts.caddy".indexOf("parts"),
      index.merged([]),
    );
    expect(references.map(({ definition, document }) => [document.uri, definition])).toEqual([
      [partsUri, true],
      [mainUri, false],
      [nestedUri, false],
    ]);
  });

  it("updates relative, quoted, and moved-source imports for file operations", () => {
    const nestedUri = "file:///workspace/sites/Caddyfile";
    const spacedUri = "file:///workspace/parts%20file.caddy";
    const index = new WorkspaceIndex();
    index.replace([
      { text: 'import "./parts file.caddy"\n', uri: mainUri },
      { text: "import ../parts.caddy\n", uri: nestedUri },
      { text: "respond spaced\n", uri: spacedUri },
      { text: "respond ok\n", uri: partsUri },
    ]);
    expect(
      importEditsForFileRenames(
        [
          {
            newUri: "file:///workspace/renamed%20file.caddy",
            oldUri: spacedUri,
          },
          {
            newUri: "file:///workspace/nested/sites",
            oldUri: "file:///workspace/sites",
          },
        ],
        index.merged([]),
      ).map(({ document, replacement }) => [document.uri, replacement]),
    ).toEqual([
      [mainUri, "./renamed file.caddy"],
      [nestedUri, "../../parts.caddy"],
    ]);
  });

  it("resolves absolute Windows imports without treating the drive as a relative folder", () => {
    const windowsMain = "file:///c%3A/workspace/Caddyfile";
    const windowsPart = "file:///c%3A/caddy/parts.caddy";
    const source = String.raw`import C:\caddy\parts.caddy` + "\n";
    const index = new WorkspaceIndex();
    index.replace([
      { text: source, uri: windowsMain },
      { text: "respond ok\n", uri: windowsPart },
    ]);
    expect(
      definitionAtWorkspace(windowsMain, source.indexOf("parts"), index.merged([])),
    ).toMatchObject({ document: { uri: windowsPart } });

    const remoteMain = "vscode-remote://ssh-remote%2Bwindows/C:/workspace/Caddyfile";
    const remotePart = "vscode-remote://ssh-remote%2Bwindows/C:/caddy/parts.caddy";
    const remoteIndex = new WorkspaceIndex();
    remoteIndex.replace([
      { text: source, uri: remoteMain },
      { text: "respond ok\n", uri: remotePart },
    ]);
    expect(
      definitionAtWorkspace(remoteMain, source.indexOf("parts"), remoteIndex.merged([])),
    ).toMatchObject({ document: { uri: remotePart } });
  });

  it("uses an absolute path when a Windows import crosses drives", () => {
    const windowsMain = "file:///c%3A/workspace/Caddyfile";
    const windowsPart = "file:///c%3A/workspace/parts.caddy";
    const index = new WorkspaceIndex();
    index.replace([
      { text: "import ./parts.caddy\n", uri: windowsMain },
      { text: "respond ok\n", uri: windowsPart },
    ]);
    expect(
      importEditsForFileRenames(
        [
          {
            newUri: "file:///d%3A/caddy/parts.caddy",
            oldUri: windowsPart,
          },
        ],
        index.merged([]),
      ).map(({ replacement }) => replacement),
    ).toEqual(["d:/caddy/parts.caddy"]);
  });

  it("diagnoses unresolved imports and every edge that participates in a cycle", () => {
    const first = "import ./parts.caddy\nimport ./missing.caddy\n";
    const second = "import ./Caddyfile\n";
    const index = new WorkspaceIndex();
    index.replace([
      { text: first, uri: mainUri },
      { text: second, uri: partsUri },
    ]);
    expect(
      workspaceImportDiagnostics(mainUri, index.merged([]), ["file:///workspace/"]),
    ).toMatchObject([
      { code: "import-cycle", severity: "error" },
      { code: "unresolved-import", severity: "warning" },
    ]);
    expect(
      workspaceImportDiagnostics(partsUri, index.merged([]), ["file:///workspace/"]),
    ).toMatchObject([{ code: "import-cycle", severity: "error" }]);
  });

  it("does not report unresolved imports outside the workspace", () => {
    const index = new WorkspaceIndex();
    index.replace([{ text: "import /etc/caddy/private\n", uri: mainUri }]);
    expect(workspaceImportDiagnostics(mainUri, index.merged([]), ["file:///workspace/"])).toEqual(
      [],
    );
  });

  it("rejects malformed snapshot entries and enforces file limits", () => {
    const index = new WorkspaceIndex();
    index.replace([
      { text: "x".repeat(1_048_577), uri: mainUri },
      { text: "respond ok\n", uri: partsUri },
      ...([null, {}, { text: 1, uri: mainUri }] as never[]),
    ]);
    expect([...index.merged([]).keys()]).toEqual([partsUri]);
  });

  it("does not index import-like text from adapter test JSON", () => {
    const testUri = "file:///workspace/adapter.caddyfiletest";
    const text = `import ./parts.caddy
----------
{"import":"./escape.caddy","snippet":"(fake)"}
`;
    const index = new WorkspaceIndex();
    index.replace([
      { text, uri: testUri },
      { text: "respond ok\n", uri: partsUri },
      { text: "respond escaped\n", uri: "file:///workspace/escape.caddy" },
    ]);
    const snapshot = index.merged([]).get(testUri);
    expect(snapshot?.tree.references.map(({ name }) => name)).toEqual(["./parts.caddy"]);
    expect(snapshot?.tree.definitions).toEqual([]);

    const open = TextDocument.create(testUri, "caddyfile-test", 2, text);
    const merged = index.merged([open]).get(testUri);
    expect(merged?.tree.references.map(({ name }) => name)).toEqual(["./parts.caddy"]);
    expect(merged?.tree.definitions).toEqual([]);
  });
});
