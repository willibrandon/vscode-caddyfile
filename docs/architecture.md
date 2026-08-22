# Architecture

The extension has a pure language core, a transport-neutral language server, and a thin VS Code
client.

| Package                    | Responsibility                                                          |
| -------------------------- | ----------------------------------------------------------------------- |
| `packages/language-core`   | Lexer, parser, formatter, language data, and analysis                   |
| `packages/language-server` | Language Server Protocol handlers and workspace import index            |
| `packages/vscode-client`   | VS Code activation, commands, workspace sync, and optional Caddy checks |

`language-core` has no Node.js, DOM, or VS Code dependency. Node IPC and browser Worker servers use
the same implementation.

`npm run build` creates desktop, remote, and browser bundles in `dist`. The exact files allowed in
the VSIX are listed in `scripts/package-files.json`.

## Boundaries

- Browser code cannot start processes or use Node.js APIs.
- Workspace files are read through VS Code and stay within the workspace index limits.
- Installed Caddy checks require a trusted desktop or remote workspace.
- Child processes use argument arrays without a shell and have time, output, cancellation, and
  process-tree limits.
- The extension does not download Caddy, call the admin API, start a server, reload configuration,
  or request elevated access.
