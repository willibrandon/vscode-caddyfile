import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { createVSIX } from "@vscode/vsce";
import { canonicalizeVsix } from "./canonicalize-vsix.mjs";
import { prepareCycloneDxForAttestation } from "./release-sbom.mjs";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const base = `caddyfile-${manifest.version}`;
const vsix = resolve(root, `dist/${base}.vsix`);
const sbom = resolve(root, `dist/${base}.cdx.json`);
const checksum = resolve(root, `dist/${base}.sha256`);
if (!/^\d+\.\d+\.\d+$/u.test(manifest.version)) {
  throw new Error(`Extension version must be major.minor.patch, received ${manifest.version}.`);
}
const { stdout: revisionOutput } = await execute("git", ["rev-parse", "HEAD"], { cwd: root });
const revision = revisionOutput.trim();
if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("Unable to determine the source revision.");
await Promise.all([
  rm(vsix, { force: true }),
  rm(sbom, { force: true }),
  rm(checksum, { force: true }),
]);
await createVSIX({
  cwd: root,
  packagePath: vsix,
  dependencies: false,
  githubBranch: revision,
  preRelease: false,
});
await writeFile(vsix, canonicalizeVsix(await readFile(vsix)));
const npmCli = process.env.npm_execpath;
if (npmCli === undefined || npmCli.length === 0) {
  throw new Error("The release artifact build must run through npm.");
}
const { stdout: generatedText } = await execute(
  process.execPath,
  [npmCli, "sbom", "--package-lock-only", "--omit", "dev", "--sbom-format", "cyclonedx"],
  { cwd: root, maxBuffer: 8 * 1024 * 1024 },
);
const generated = JSON.parse(generatedText);
const prepared = prepareCycloneDxForAttestation(
  generated,
  `${manifest.publisher}.${manifest.name}@${manifest.version}:${revision}`,
);
await writeFile(sbom, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");
const digest = createHash("sha256")
  .update(await readFile(vsix))
  .digest("hex");
await writeFile(checksum, `${digest}  ${basename(vsix)}\n`, "utf8");
const sbomText = await readFile(sbom, "utf8");
if (/(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\\\Users\\\\[^\\\s]+)/u.test(sbomText)) {
  throw new Error("The generated SBOM contains a private build path.");
}
console.log(`Created ${basename(vsix)}, ${basename(checksum)}, and ${basename(sbom)} (stable).`);
