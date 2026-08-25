# Changelog

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
