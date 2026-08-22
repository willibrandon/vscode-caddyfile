---
title: Privacy and trust
description: Files, programs, and logs used by the extension.
---

The extension has no telemetry and makes no runtime network requests.

It reads recognized workspace files through VS Code. It does not read Caddy's live configuration or
call the admin API.

Installed Caddy checks are off by default. They require a trusted desktop or remote workspace and
run without a shell. Time and output limits apply.

Normal logs omit document text. Protocol traces can include it.
