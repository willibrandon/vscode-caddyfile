---
title: Settings
description: Caddyfile extension settings.
---

| Setting                              | Default     | Purpose                                           |
| ------------------------------------ | ----------- | ------------------------------------------------- |
| `caddyfile.validation.enable`        | `true`      | Enable built-in diagnostics.                      |
| `caddyfile.validation.maxProblems`   | `200`       | Limit diagnostics per file.                       |
| `caddyfile.diagnostics.unknownItems` | `hint`      | Set unknown items to `off`, `hint`, or `warning`. |
| `caddyfile.caddy.command`            | `["caddy"]` | Set the executable and wrapper arguments.         |
| `caddyfile.caddy.checkOnSave`        | `false`     | Check saved files with installed Caddy.           |
| `caddyfile.trace.server`             | `off`       | Set protocol trace detail.                        |

Executable settings are blocked in untrusted workspaces. Protocol traces can contain document text.
