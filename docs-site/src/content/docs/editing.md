---
title: Editing
description: Completion, hover, diagnostics, navigation, and formatting.
---

Completion suggests directives, options, matchers, and subdirectives for the current block. Hover
explains the item and links to Caddy's documentation.

![Documentation shown for a Caddyfile directive](../../assets/hover.png)

Diagnostics find structural errors and close spelling mistakes. Unknown names stay hints because
Caddy modules can add directives.

![A Caddyfile diagnostic and quick fix](../../assets/diagnostic.png)

Definitions, references, rename, symbols, folding, and selection work across imported files.

**Format Document** follows `caddy fmt`. It edits the open document and does not enable format on
save.
