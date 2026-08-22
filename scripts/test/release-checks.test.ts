import { describe, expect, it } from "vitest";

interface ReleaseChecksModule {
  readonly githubReleaseFailures: (state: Record<string, unknown>) => readonly string[];
  readonly requiredMainWorkflows: readonly string[];
}

const checks = (await import(
  new URL("../release-checks.mjs", import.meta.url).href
)) as ReleaseChecksModule;

describe("release source checks", () => {
  it("accepts an annotated tag at a fully green main head", () => {
    const head = "a".repeat(40);
    expect(
      checks.githubReleaseFailures({
        workflowRuns: checks.requiredMainWorkflows.map((name, index) => ({
          conclusion: "success",
          event: "push",
          head_branch: "main",
          head_sha: head,
          id: index + 1,
          name,
        })),
        head,
        mainRef: { object: { sha: head } },
        tagObject: {
          object: { sha: head },
          verification: { reason: "unsigned", verified: false },
        },
        tagRef: { object: { type: "tag" } },
      }),
    ).toEqual([]);
  });

  it("rejects lightweight tags, stale main commits, and incomplete checks", () => {
    const failures = checks.githubReleaseFailures({
      workflowRuns: [
        {
          conclusion: "success",
          event: "pull_request",
          head_branch: "pull/2",
          head_sha: "a".repeat(40),
          id: 2,
          name: "CI",
        },
        {
          conclusion: "failure",
          event: "push",
          head_branch: "main",
          head_sha: "a".repeat(40),
          id: 3,
          name: "CI",
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
        "release tag does not point to HEAD",
        "release commit is not the current main head",
        "CI workflow has not passed on main",
        "CodeQL workflow has not passed on main",
      ]),
    );
  });
});
