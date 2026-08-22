import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

describe("language-core architecture", () => {
  it("has no Node, DOM, VS Code, process, environment, or network dependency", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const manifest = JSON.parse(
      await readFile(resolve(root, "packages/language-core/package.json"), "utf8"),
    ) as Readonly<{ dependencies?: unknown; devDependencies?: unknown }>;
    const files = await glob("packages/language-core/src/**/*.ts", {
      absolute: true,
      cwd: root,
    });
    const violations: string[] = [];

    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.devDependencies).toBeUndefined();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (
        /(?:from\s+|import\s*\()\s*["'](?:node:|vscode)|\bprocess\.(?:argv|cwd|env|platform)|\bglobalThis\.(?:document|fetch|navigator|WebSocket|window|XMLHttpRequest)|(?<![\w.])fetch\(/u.test(
          source,
        )
      ) {
        violations.push(file.slice(root.length + 1));
      }
    }

    expect(violations).toEqual([]);
  });
});
