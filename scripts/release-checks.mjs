export const requiredMainChecks = [
  "Secret scan",
  "Quality and bundles",
  "Package exact VSIX",
  "Desktop (ubuntu-latest, VS Code 1.102.0)",
  "Desktop (ubuntu-latest, VS Code stable)",
  "Desktop (macos-latest, VS Code 1.102.0)",
  "Desktop (macos-latest, VS Code stable)",
  "Desktop (windows-latest, VS Code 1.102.0)",
  "Desktop (windows-latest, VS Code stable)",
  "Browser Worker",
  "Pinned upstream conformance",
  "Remote SSH host",
  "Dev container",
  "analyze",
  "Build docs",
  "Deploy docs",
];

export function githubReleaseFailures({ checkRuns, head, mainRef, tagObject, tagRef }) {
  const failures = [];
  if (tagRef?.object?.type !== "tag") failures.push("release tag is not annotated");
  if (tagObject?.verification?.verified !== true) {
    failures.push(
      `release tag signature is not verified (${String(tagObject?.verification?.reason ?? "unknown")})`,
    );
  }
  if (tagObject?.object?.sha !== head) failures.push("release tag does not point to HEAD");
  if (mainRef?.object?.sha !== head) failures.push("release commit is not the current main head");

  const latestByName = new Map();
  for (const run of checkRuns ?? []) {
    if (run?.check_suite?.head_branch !== "main" || typeof run?.name !== "string") continue;
    const existing = latestByName.get(run.name);
    if (existing === undefined || Number(run.id ?? 0) > Number(existing.id ?? 0)) {
      latestByName.set(run.name, run);
    }
  }
  for (const name of requiredMainChecks) {
    const run = latestByName.get(name);
    if (run?.conclusion !== "success") {
      failures.push(`${name} has not passed on main`);
    }
  }
  return failures;
}
