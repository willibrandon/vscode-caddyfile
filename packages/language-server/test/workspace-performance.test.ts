import { describe, expect, it } from "vitest";
import { WorkspaceIndex, importTargets } from "../src/workspace-index.js";

const performanceBudgetMilliseconds = 2_000;

describe("workspace index performance", () => {
  it("indexes and resolves a large imported workspace within the budget", () => {
    const mainUri = "file:///workspace/Caddyfile";
    const main = "import ./parts/*.caddy\n";
    const files = [
      { text: main, uri: mainUri },
      ...Array.from({ length: 1_000 }, (_, index) => ({
        text: `(snippet-${index}) {\n\trespond ${index}\n}\n`,
        uri: `file:///workspace/parts/${index.toString().padStart(4, "0")}.caddy`,
      })),
    ];

    const started = performance.now();
    const index = new WorkspaceIndex();
    index.replace(files);
    const documents = index.merged([]);
    const reference = documents.get(mainUri)?.tree.references[0];
    const targets = reference === undefined ? [] : importTargets(mainUri, reference, documents);
    const elapsed = performance.now() - started;

    expect(documents).toHaveLength(1_001);
    expect(targets).toHaveLength(1_000);
    expect(elapsed).toBeLessThan(performanceBudgetMilliseconds);
  });
});
