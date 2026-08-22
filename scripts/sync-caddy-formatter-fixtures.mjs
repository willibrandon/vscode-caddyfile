import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(await readFile(resolve(root, "upstream-lock.json"), "utf8"));
const source = process.env.CADDY_SOURCE ?? resolve(root, "..", "caddy");
const ref = process.env.CADDY_REF ?? lock.caddy.currentCommit;
const upstreamPath = "caddyconfig/caddyfile/formatter_test.go";
const outputPath = resolve(
  root,
  process.env.CADDY_FORMATTER_FIXTURES ?? "test/fixtures/upstream/caddy/formatter-cases.json",
);
const { stdout } = await execute("git", ["-C", source, "show", `${ref}:${upstreamPath}`], {
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});
const cases = parseFormatterCases(stdout).map((item) => ({
  ...item,
  expect: item.expect.endsWith("\n") ? item.expect : item.expect + "\n",
}));
if (cases.length !== 30) {
  throw new Error(
    `Expected 30 Caddy formatter cases, extracted ${cases.length}: ${cases.map(({ description }) => description).join(", ")}.`,
  );
}
const fixture = {
  schema: 1,
  upstream: {
    commit: ref,
    file: upstreamPath,
    license: "Apache-2.0",
    repository: lock.caddy.repository,
  },
  cases,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(fixture, null, 2) + "\n", "utf8");

function parseFormatterCases(goSource) {
  const marker = goSource.indexOf("for i, tc := range []struct");
  const composite = goSource.indexOf("}{", marker);
  if (marker < 0 || composite < 0) throw new Error("Caddy formatter table was not found.");
  const blocks = [];
  let depth = 1;
  let start;
  let quote = "";
  let escaped = false;
  for (let index = composite + 2; index < goSource.length; index++) {
    const character = goSource[index];
    if (quote === "`") {
      if (character === "`") quote = "";
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = "";
      continue;
    }
    if (character === "`" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "{") {
      depth++;
      if (depth === 2) start = index + 1;
      continue;
    }
    if (character !== "}") continue;
    if (depth === 2 && start !== undefined) {
      blocks.push(goSource.slice(start, index));
      start = undefined;
    }
    depth--;
    if (depth === 0) break;
  }
  return blocks.map((block) => ({
    description: stringField(block, "description"),
    input: stringField(block, "input"),
    expect: stringField(block, "expect"),
  }));
}

function stringField(block, field) {
  const match = new RegExp(`(?:^|\\n)\\s*${field}:\\s*`, "u").exec(block);
  if (match === null) throw new Error(`Formatter case is missing ${field}.`);
  const expression = readExpression(block, match.index + match[0].length);
  let result = "";
  for (let index = 0; index < expression.length;) {
    while (/\s|\+/u.test(expression[index] ?? "")) index++;
    const delimiter = expression[index];
    if (delimiter === "`") {
      const end = expression.indexOf("`", index + 1);
      if (end < 0) throw new Error("Unterminated Go raw string.");
      result += expression.slice(index + 1, end);
      index = end + 1;
      continue;
    }
    if (delimiter === '"') {
      let end = index + 1;
      let escaped = false;
      while (end < expression.length) {
        const character = expression[end];
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') break;
        end++;
      }
      result += JSON.parse(expression.slice(index, end + 1));
      index = end + 1;
      continue;
    }
    if (delimiter === undefined) break;
    throw new Error("Unsupported Go string expression: " + expression);
  }
  return result;
}

function readExpression(block, start) {
  let quote = "";
  let escaped = false;
  for (let index = start; index < block.length; index++) {
    const character = block[index];
    if (quote === "`") {
      if (character === "`") quote = "";
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = "";
      continue;
    }
    if (character === "`" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ",") return block.slice(start, index).trim();
  }
  throw new Error("Unterminated formatter field.");
}
