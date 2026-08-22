---
title: Troubleshooting
description: Fix recognition, completion, and installed Caddy checks.
---

## No highlighting

Check the status bar for `Caddyfile`. For an unusual name, set its language mode or add a
`files.associations` entry. Install the extension again inside WSL, SSH, or a Dev Container.

## No completion or hover

Run **Show Output**, then **Restart Language Server**.

## Caddy check fails

Run **Show Caddy Information**. Confirm the file is local to the current extension host, the
workspace is trusted, and `caddyfile.caddy.command` works on that host.

[Report an issue](https://github.com/willibrandon/vscode-caddyfile/issues) with the extension
version, host, and sanitized output.
