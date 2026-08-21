import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(await readFile(resolve(root, "upstream-lock.json"), "utf8"));
const source = process.env.CADDY_SOURCE ?? resolve(root, "..", "caddy");
const ref = process.env.CADDY_REF ?? lock.caddy.currentCommit;
const outputPath = resolve(root, "test/fixtures/upstream/caddy/registry.json");
const directives = await registrations(/Register(?:Handler)?Directive\("([^"]+)"/gu);
const globalOptions = await registrations(/RegisterGlobalOption\("([^"]+)"/gu);
if (directives.names.length !== 42) {
  throw new Error(`Expected 42 standard directives, found ${directives.names.length}.`);
}
if (globalOptions.names.length !== 40) {
  throw new Error(`Expected 40 standard global options, found ${globalOptions.names.length}.`);
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      schema: 1,
      upstream: {
        commit: ref,
        license: "Apache-2.0",
        repository: lock.caddy.repository,
      },
      directives: directives.names,
      globalOptions: globalOptions.names,
      sourceFiles: [...new Set([...directives.files, ...globalOptions.files])].sort(),
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

async function registrations(pattern) {
  const { stdout } = await execute(
    "git",
    ["-C", source, "grep", "-n", "Register", ref, "--", "*.go"],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const names = new Set();
  const files = new Set();
  for (const line of stdout.trim().split("\n")) {
    for (const match of line.matchAll(pattern)) names.add(match[1]);
    const sourceMatch = /^[^:]+:([^:]+):\d+:/u.exec(line);
    if (sourceMatch?.[1] !== undefined) files.add(sourceMatch[1]);
  }
  return { files: [...files].sort(), names: [...names].sort() };
}
