---
title: Imports
description: Navigate Caddyfile imports, snippets, and named routes.
---

Import links open local files. Definition, references, and rename follow imported snippets and named
routes.

```caddyfile
import parts/*.caddy

example.com {
	import security
	invoke backend
}
```

The index supports literal paths, globs, extensionless imports, and import cycles. Files stay in the
workspace and are read through VS Code, so this also works in remote and virtual workspaces.
