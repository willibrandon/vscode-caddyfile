import { describe, expect, it } from "vitest";

interface ReleaseChecksModule {
  readonly githubReleaseFailures: (state: Record<string, unknown>) => readonly string[];
  readonly requiredMainChecks: readonly string[];
}

const checks = (await import(
  new URL("../release-checks.mjs", import.meta.url).href
)) as ReleaseChecksModule;

describe("release source checks", () => {
  it("accepts a verified annotated tag at a fully green main head", () => {
    const head = "a".repeat(40);
    expect(
      checks.githubReleaseFailures({
        checkRuns: checks.requiredMainChecks.map((name, index) => ({
          check_suite: { head_branch: "main" },
          conclusion: "success",
          id: index + 1,
          name,
        })),
        head,
        mainRef: { object: { sha: head } },
        tagObject: {
          object: { sha: head },
          verification: { reason: "valid", verified: true },
        },
        tagRef: { object: { type: "tag" } },
      }),
    ).toEqual([]);
  });

  it("rejects unsigned tags, stale main commits, and incomplete checks", () => {
    const failures = checks.githubReleaseFailures({
      checkRuns: [
        {
          check_suite: { head_branch: "pull/2" },
          conclusion: "success",
          id: 2,
          name: "Secret scan",
        },
        {
          check_suite: { head_branch: "main" },
          conclusion: "failure",
          id: 3,
          name: "Secret scan",
        },
      ],
      head: "a".repeat(40),
      mainRef: { object: { sha: "b".repeat(40) } },
      tagObject: {
        object: { sha: "c".repeat(40) },
        verification: { reason: "unsigned", verified: false },
      },
      tagRef: { object: { type: "commit" } },
    });
    expect(failures).toEqual(
      expect.arrayContaining([
        "release tag is not annotated",
        "release tag signature is not verified (unsigned)",
        "release tag does not point to HEAD",
        "release commit is not the current main head",
        "Secret scan has not passed on main",
        "Quality and bundles has not passed on main",
      ]),
    );
  });
});
