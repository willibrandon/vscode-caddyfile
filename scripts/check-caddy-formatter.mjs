import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const executable = process.env.CADDY_BIN ?? resolve(root, ".cache", "caddy-integration");
const fixture = JSON.parse(
  await readFile(resolve(root, "test/fixtures/upstream/caddy/formatter-cases.json"), "utf8"),
);
for (const testCase of fixture.cases) {
  const first = await format(testCase.input);
  if (first.stdout !== testCase.expect) {
    throw new Error(`Caddy formatter output differs for "${testCase.description}".`);
  }
  const second = await format(first.stdout);
  if (second.exitCode !== 0 || second.stdout !== first.stdout) {
    throw new Error(`Caddy formatter is not idempotent for "${testCase.description}".`);
  }
}

function format(input) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, ["fmt", "-"], {
      cwd: root,
      shell: false,
      stdio: "pipe",
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolveResult({
        exitCode,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}
