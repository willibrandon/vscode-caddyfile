import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(await readFile(resolve(root, "upstream-lock.json"), "utf8"));
const source = process.env.CADDY_SOURCE ?? resolve(root, "..", "caddy");
const ref = process.env.CADDY_REF ?? lock.caddy.currentCommit;
const fixtureRoot = resolve(root, "test/fixtures/upstream/caddy");
const adapterRoot = "caddytest/integration/caddyfile_adapt";
const sourceTests = [
  "caddyconfig/caddyfile/dispenser_test.go",
  "caddyconfig/caddyfile/lexer_test.go",
  "caddyconfig/caddyfile/parse_test.go",
];
const { stdout: listing } = await execute(
  "git",
  ["-C", source, "ls-tree", "-r", "--name-only", ref, adapterRoot],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
);
const adapterFiles = listing
  .trim()
  .split("\n")
  .filter((path) => path.endsWith(".caddyfiletest"))
  .sort();
if (adapterFiles.length !== 233) {
  throw new Error(`Expected 233 adapter fixtures, found ${adapterFiles.length}.`);
}
const manifestFiles = [];
for (const upstreamPath of [...adapterFiles, ...sourceTests]) {
  const content = await gitShow(upstreamPath);
  const relativePath = adapterFiles.includes(upstreamPath)
    ? join("adapter", relative(adapterRoot, upstreamPath))
    : join("source-tests", upstreamPath.split("/").at(-1));
  const outputPath = resolve(fixtureRoot, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
  manifestFiles.push({
    path: relativePath.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(content).digest("hex"),
    size: content.byteLength,
    upstreamPath,
  });
}
await writeFile(
  resolve(fixtureRoot, "corpus-manifest.json"),
  JSON.stringify(
    {
      schema: 1,
      upstream: {
        commit: ref,
        license: "Apache-2.0",
        repository: lock.caddy.repository,
      },
      files: manifestFiles,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

async function gitShow(path) {
  const { stdout } = await execute("git", ["-C", source, "show", `${ref}:${path}`], {
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}
