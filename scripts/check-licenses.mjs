import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const approvedLicenses = new Set([
  "(MIT AND Zlib)",
  "(MIT OR CC0-1.0)",
  "(MIT OR GPL-3.0-or-later)",
  "0BSD",
  "Apache-2.0",
  "Artistic-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-3.0",
  "CC0-1.0",
  "EPL-2.0",
  "ISC",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "SEE LICENSE IN LICENSE.txt",
  "WTFPL",
]);
const expectedRuntimePackages = new Map([
  ["balanced-match@4.0.4", "balanced-match-4.0.4.txt"],
  ["brace-expansion@5.0.9", "brace-expansion-5.0.9.txt"],
  ["minimatch@10.2.6", "minimatch-10.2.6.txt"],
  ["semver@7.8.5", "semver-7.8.5.txt"],
  ["vscode-jsonrpc@9.0.1", "vscode-jsonrpc-9.0.1.txt"],
  ["vscode-languageclient@10.1.0", "vscode-languageclient-10.1.0.txt"],
  ["vscode-languageserver@10.1.0", "vscode-languageserver-10.1.0.txt"],
  ["vscode-languageserver-protocol@3.18.2", "vscode-languageserver-protocol-3.18.2.txt"],
  ["vscode-languageserver-textdocument@1.0.12", "vscode-languageserver-textdocument-1.0.12.txt"],
  ["vscode-languageserver-types@3.18.0", "vscode-languageserver-types-3.18.0.txt"],
  ["vscode-uri@3.1.0", "vscode-uri-3.1.0.txt"],
]);
const expectedLicenseHashes = new Map([
  ["Caddy-Apache-2.0.txt", "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"],
  ["balanced-match-4.0.4.txt", "d408f38ffa3355c5faec517153295338892eb0f1ea43f57874bb23c6075979b5"],
  ["brace-expansion-5.0.9.txt", "9c63a23124d68cd30cd316a94a1a0bca34f032786df6df69fc4b5f136bac8d2e"],
  ["minimatch-10.2.6.txt", "2c7c5d22ed5a8ee968c64757710979afcd77438c48b4a265b94e615babd8a901"],
  ["semver-7.8.5.txt", "4ec3d4c66cd87f5c8d8ad911b10f99bf27cb00cdfcff82621956e379186b016b"],
  ["vscode-jsonrpc-9.0.1.txt", "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0"],
  [
    "vscode-languageclient-10.1.0.txt",
    "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0",
  ],
  [
    "vscode-languageserver-10.1.0.txt",
    "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0",
  ],
  [
    "vscode-languageserver-protocol-3.18.2.txt",
    "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0",
  ],
  [
    "vscode-languageserver-textdocument-1.0.12.txt",
    "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0",
  ],
  [
    "vscode-languageserver-types-3.18.0.txt",
    "ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0",
  ],
  ["vscode-uri-3.1.0.txt", "5bf78228f68c7cd7811974f8e98a4c9bec9fdf4adf5c2a3f222184898c669f5b"],
]);
const mitSha256 = "f74f925ccd6fc2f4b9bdf7682f6927a64809c8668e8232997c541cc6f992787b";

const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const failures = [];
for (const [packagePath, metadata] of Object.entries(lock.packages)) {
  if (
    packagePath === "" ||
    packagePath.startsWith("packages/") ||
    packagePath.startsWith("node_modules/@caddyfile/")
  ) {
    continue;
  }
  const license = metadata.license;
  if (typeof license !== "string") {
    failures.push(`${packagePath} has no declared license`);
  } else if (!approvedLicenses.has(license)) {
    failures.push(
      `${packagePath} introduced unreviewed license expression ${JSON.stringify(license)}`,
    );
  }
}

if (sha256(await readFile(resolve(root, "LICENSE"))) !== mitSha256) {
  failures.push("LICENSE is not the reviewed MIT text");
}
for (const [fileName, expectedHash] of expectedLicenseHashes) {
  const actualHash = sha256(await readFile(resolve(root, "LICENSES", fileName)));
  if (actualHash !== expectedHash) failures.push(`${fileName} is not the reviewed license text`);
}

const notices = await readFile(resolve(root, "THIRD-PARTY-NOTICES.md"), "utf8");
if (!notices.includes("Caddy-Apache-2.0.txt") || !notices.includes("Apache-2.0")) {
  failures.push("third-party notice missing for the Caddy-derived formatter");
}
const metafiles = JSON.parse(await readFile(resolve(root, "dist/metafile.json"), "utf8"));
const bundledNames = new Set();
for (const metafile of metafiles) {
  for (const input of Object.keys(metafile.inputs)) {
    const match = /node_modules\/(?:@[^/]+\/[^/]+|[^/]+)/u.exec(input);
    if (match !== null) bundledNames.add(match[0].slice("node_modules/".length));
  }
}
const bundledPackages = new Set(
  [...bundledNames].map((name) => {
    const entry = lock.packages[`node_modules/${name}`];
    if (entry?.version === undefined) {
      failures.push(`bundled dependency ${name} has no root lockfile entry`);
      return `${name}@unknown`;
    }
    return `${name}@${entry.version}`;
  }),
);
for (const [packageId, licenseFile] of expectedRuntimePackages) {
  if (!bundledPackages.has(packageId))
    failures.push(`expected runtime dependency missing: ${packageId}`);
  if (!notices.includes(packageId) || !notices.includes(licenseFile)) {
    failures.push(`third-party notice missing: ${packageId}`);
  }
}
for (const packageId of bundledPackages) {
  if (!expectedRuntimePackages.has(packageId)) {
    failures.push(`unreviewed runtime dependency entered a bundle: ${packageId}`);
  }
}

if (failures.length > 0) {
  throw new Error(`License policy failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `License policy passed for ${Object.keys(lock.packages).length - 1} lockfile entries and ${bundledPackages.size} bundled dependencies.`,
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
