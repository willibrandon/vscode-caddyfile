import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createOnigScanner, createOnigString, loadWASM } from "vscode-oniguruma";
import { Registry } from "vscode-textmate";
import type { IGrammar, IRawGrammar, IToken } from "vscode-textmate";

let initialized: Promise<void> | undefined;
const grammarPaths: Readonly<Record<string, string>> = {
  "source.caddyfile": "syntaxes/caddyfile.tmLanguage.json",
  "source.caddyfile.markdown": "syntaxes/caddyfile-markdown.tmLanguage.json",
  "source.caddyfile.test": "syntaxes/caddyfile-test.tmLanguage.json",
};
const jsonGrammar: IRawGrammar = {
  patterns: [
    { name: "string.quoted.double.json", match: '"[^"]*"' },
    { name: "constant.language.json", match: "\\b(?:true|false|null)\\b" },
    { name: "constant.numeric.json", match: "-?[0-9]+(?:\\.[0-9]+)?" },
  ],
  repository: {
    $base: { include: "source.json" },
    $self: { include: "source.json" },
  },
  scopeName: "source.json",
};

export async function loadGrammar(scopeName: string): Promise<IGrammar> {
  initialized ??= initializeOniguruma();
  await initialized;
  const root = resolve(import.meta.dirname, "../..");
  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    async loadGrammar(requested): Promise<IRawGrammar | null> {
      if (requested === "source.json") return jsonGrammar;
      const path = grammarPaths[requested];
      if (path === undefined) return null;
      return JSON.parse(await readFile(resolve(root, path), "utf8")) as IRawGrammar;
    },
  });
  const grammar = await registry.loadGrammar(scopeName);
  if (grammar === null) throw new Error("Unable to load " + scopeName + ".");
  return grammar;
}

export function tokenAt(
  grammar: IGrammar,
  source: string,
  lineIndex: number,
  character: number,
): IToken {
  let ruleStack = null;
  const lines = source.split(/\r\n|\n|\r/u);
  for (let index = 0; index <= lineIndex; index++) {
    const result = grammar.tokenizeLine(lines[index] ?? "", ruleStack);
    ruleStack = result.ruleStack;
    if (index !== lineIndex) continue;
    const selected = result.tokens.find(
      ({ startIndex, endIndex }) => startIndex <= character && character < endIndex,
    );
    if (selected !== undefined) return selected;
  }
  throw new Error(`No token at ${lineIndex}:${character}.`);
}

async function initializeOniguruma(): Promise<void> {
  const wasmPath = resolve(
    import.meta.dirname,
    "../../node_modules/vscode-oniguruma/release/onig.wasm",
  );
  const wasm = await readFile(wasmPath);
  await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
}
