---
title: Caddy checks
description: Check a file with Caddy installed on the current host.
---

Built-in editing does not need Caddy. Use **Check with Caddy** when you want the installed binary's
result. **Show Adapted JSON** opens the adapter output.

Caddy errors and warnings appear in Problems. A successful adaptation can still report warnings.

Checks require a trusted desktop or remote workspace. The current text is sent to Caddy on standard
input. The extension does not start or reload a server.

`caddyfile.caddy.command` is an argument array. Each item is passed literally and no shell runs.

```json
{
  "caddyfile.caddy.command": [
    "docker",
    "run",
    "--rm",
    "-i",
    "-v",
    "/home/me/project:/work",
    "-w",
    "/work",
    "caddy:2.11.4",
    "caddy"
  ]
}
```
