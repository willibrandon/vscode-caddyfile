# Releasing

Releases are stable. The same VSIX is published to the Visual Studio Marketplace, Open VSX, and the
GitHub release.

## Requirements

- `main` is clean and every required check passes.
- Publisher access is configured for both registries.
- `CHANGELOG.md` has the version and release date.
- `VSCE_PAT` and `OVSX_PAT` are repository secrets.
- The final VSIX has been tested and approved.
- The release tag is annotated, signed, and verified by GitHub.

## Prepare

```sh
npm run verify
npm run test:docs
npm run package
npm run check:release-reproducibility
```

Confirm the publisher, version, stable channel, checksum, SBOM, and exact packaged file list. Commit
and push the release preparation, then wait for every required workflow.

## Publish

Create the signed tag interactively and push only that tag:

```sh
release_version=$(node -p "require('./package.json').version")
git tag -s "v$release_version" -m "Caddyfile $release_version"
git push origin "v$release_version"
```

The workflow rebuilds and reproduces the artifacts, tests the exact VSIX on desktop, browser, and
Remote SSH hosts, creates attestations and a draft GitHub release, publishes both registries,
verifies them, then publishes the GitHub release.

The workflow stops before building if the tag is unsigned, is not at the current `main` head, or any
required `main` check is not green.

Never move or reuse a published tag or version.
