import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(await readFile(resolve(root, "upstream-lock.json"), "utf8"));
const sources = [
  {
    commits: [lock.caddy.stableCommit, lock.caddy.currentCommit],
    label: "Caddy",
    path: process.env.CADDY_CURRENT_SOURCE ?? resolve(root, "..", "caddy"),
    repository: lock.caddy.repository,
  },
  {
    commits: [lock.website.commit],
    label: "Caddy website",
    path: process.env.CADDY_WEBSITE_SOURCE ?? resolve(root, "..", "caddyserver-website"),
    repository: lock.website.repository,
  },
  {
    commits: [lock.treeSitter.commit, lock.treeSitter.pullRequests["64"]],
    label: "tree-sitter-caddyfile",
    path: process.env.TREE_SITTER_CADDYFILE_SOURCE ?? resolve(root, "..", "tree-sitter-caddyfile"),
    repository: lock.treeSitter.repository,
  },
];

for (const source of sources) {
  const remote = await git(source.path, ["remote", "get-url", "origin"]);
  if (normalizeRepository(remote) !== normalizeRepository(source.repository)) {
    throw new Error(`${source.label} remote is ${remote}, expected ${source.repository}.`);
  }
  for (const commit of source.commits) {
    await git(source.path, ["cat-file", "-e", `${commit}^{commit}`]);
  }
}

const stableSource = process.env.CADDY_STABLE_SOURCE ?? sources[0].path;
const stableTagCommit = await git(stableSource, [
  "rev-parse",
  `${lock.caddy.stableVersion}^{commit}`,
]);
if (stableTagCommit !== lock.caddy.stableCommit) {
  throw new Error(
    `${lock.caddy.stableVersion} resolves to ${stableTagCommit}, expected ${lock.caddy.stableCommit}.`,
  );
}

const websiteSource = sources[1].path;
const registry = await loadRegistry();
const missingPages = [];
for (const item of registry.allLanguageItems) {
  const url = new URL(item.url);
  if (url.origin !== "https://caddyserver.com" || !url.pathname.startsWith("/docs/")) {
    throw new Error(`${item.kind} ${item.name} has an unexpected documentation URL: ${item.url}`);
  }
  const relative = url.pathname.slice("/docs/".length);
  const page = resolve(websiteSource, "src/docs/markdown", `${relative}.md`);
  try {
    await access(page);
  } catch {
    missingPages.push(`${item.kind} ${item.name}: ${relative}.md`);
  }
}
if (missingPages.length > 0) {
  throw new Error(`Pinned documentation pages are missing:\n${missingPages.join("\n")}`);
}

console.log(
  `Verified ${sources.length} upstream repositories, ${sources.flatMap(({ commits }) => commits).length} pinned commits, and ${registry.allLanguageItems.length} documentation links.`,
);

async function loadRegistry() {
  const result = await build({
    bundle: true,
    entryPoints: [resolve(root, "packages/language-core/src/registry.ts")],
    format: "esm",
    platform: "neutral",
    write: false,
  });
  const output = result.outputFiles[0]?.text;
  if (output === undefined) throw new Error("The language registry bundle was not produced.");
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

async function git(directory, arguments_) {
  const { stdout } = await execute("git", ["-C", directory, ...arguments_], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function normalizeRepository(value) {
  return value
    .trim()
    .replace(/\.git$/u, "")
    .replace(/^git@github\.com:/u, "https://github.com/");
}
