# Changelog

## [0.2.2] - 2026-09-03

- Updated the bundled vscode-uri library to 3.2.0 and vscode-languageserver-textdocument to 1.0.14.
- Cleared the fast-uri and qs npm advisories from the development toolchain. Neither package ships
  in the extension.
- Refreshed the reviewed Caddy and tree-sitter-caddyfile pins to their current upstream heads. The
  fixture content is unchanged.
- Hardened the desktop integration suite against file watcher start-up latency on macOS.
- Updated the CodeQL Action to 4.37.9 and refreshed the development container base image digests.

## [0.2.1] - 2026-08-28

- Made ambient Caddyfile discovery honor `files.exclude`, nested `.gitignore` rules, and common
  generated-output directories while preserving navigation to explicitly imported files.
- Added a default-on `caddyfile.index.useIgnoreFiles` setting and live index refresh when ignore
  settings or ignore files change.
- Normalized Windows workspace URIs before applying ignore rules and added desktop, browser,
  manifest, and cross-platform regression coverage.

## [0.2.0] - 2026-08-24

- Language support for Caddy's experimental route-scoped `timeouts` directive, including
  `read_timeout`, `write_timeout`, and `max_write_chunk` completion and hover guidance.
- Refreshed the reviewed Caddy fixtures and directive registry to the current upstream head.
- Upstream count changes now produce a reviewable drift issue and warning instead of aborting or
  leaving the scheduled workflow red.
- Updated the CodeQL Action to 4.37.8.

## [0.1.0] - 2026-08-21

- Caddyfile syntax highlighting, completion, hover, diagnostics, quick fixes, and formatting.
- Navigation across imports, snippets, matchers, and named routes.
- Desktop, browser, Remote SSH, WSL, and Dev Container support.
- Optional checks and adapted JSON using an installed Caddy command.
- Pinned Caddy formatter and parser regression coverage.
- Reproducible VSIX, checksums, SBOM, attestations, and signed release workflow.
