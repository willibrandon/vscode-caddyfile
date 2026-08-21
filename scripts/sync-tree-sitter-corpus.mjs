import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(await readFile(resolve(root, "upstream-lock.json"), "utf8"));
const source =
  process.env.TREE_SITTER_CADDYFILE_SOURCE ?? resolve(root, "..", "tree-sitter-caddyfile");
const baseRef = process.env.TREE_SITTER_CADDYFILE_REF ?? lock.treeSitter.commit;
const pullRequestRef =
  process.env.TREE_SITTER_CADDYFILE_PR_64_REF ?? lock.treeSitter.pullRequests["64"];
const fixtureRoot = resolve(root, "test/fixtures/upstream/tree-sitter-caddyfile");
const corpusRoot = "test/corpus";
const pullRequestFiles = ["named_matchers.txt", "sites.txt"];
const { stdout: listing } = await execute(
  "git",
  ["-C", source, "ls-tree", "-r", "--name-only", baseRef, corpusRoot],
  { encoding: "utf8", maxBuffer: 1024 * 1024 },
);
const corpusFiles = listing
  .trim()
  .split("\n")
  .filter((path) => path.endsWith(".txt"))
  .sort();
if (corpusFiles.length !== 14) {
  throw new Error(`Expected 14 tree-sitter corpus files, found ${corpusFiles.length}.`);
}

const manifestFiles = [];
for (const upstreamPath of corpusFiles) {
  await vendor({
    ref: baseRef,
    relativePath: join("base", upstreamPath.slice(corpusRoot.length + 1)),
    sourceKind: "base",
    upstreamPath,
  });
}
for (const filename of pullRequestFiles) {
  await vendor({
    ref: pullRequestRef,
    relativePath: join("pull-64", filename),
    sourceKind: "pull-64",
    upstreamPath: join(corpusRoot, filename),
  });
}

await writeFile(
  resolve(fixtureRoot, "corpus-manifest.json"),
  JSON.stringify(
    {
      schema: 1,
      upstream: {
        commit: baseRef,
        license: "MIT",
        repository: lock.treeSitter.repository,
      },
      pullRequests: {
        64: {
          commit: pullRequestRef,
          files: pullRequestFiles,
          url: "https://github.com/caddyserver/tree-sitter-caddyfile/pull/64",
        },
      },
      files: manifestFiles,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

async function vendor({ ref, relativePath, sourceKind, upstreamPath }) {
  const { stdout: content } = await execute(
    "git",
    ["-C", source, "show", `${ref}:${upstreamPath}`],
    {
      encoding: "buffer",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const outputPath = resolve(fixtureRoot, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
  manifestFiles.push({
    path: relativePath.replaceAll("\\", "/"),
    ref,
    sha256: createHash("sha256").update(content).digest("hex"),
    size: content.byteLength,
    sourceKind,
    upstreamPath,
  });
}
