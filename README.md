# Caddyfile

Language support for Caddyfiles in Visual Studio Code.

## Features

- Syntax highlighting and formatting
- Completions, hover documentation, diagnostics, and navigation
- Snippets, matchers, named routes, placeholders, and imports
- Optional checks with an installed Caddy command
- Desktop, remote, and browser extension hosts

The extension does not require Caddy for normal editing and never downloads or starts Caddy.

## Install

Search for **Caddyfile** in the Extensions view or run:

```sh
code --install-extension willibrandon.caddyfile
```

[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=willibrandon.caddyfile)
and [Open VSX](https://open-vsx.org/extension/willibrandon/caddyfile) publish the same extension.

[Documentation](https://willibrandon.github.io/vscode-caddyfile/) · [Changelog](CHANGELOG.md) ·
[Issues](https://github.com/willibrandon/vscode-caddyfile/issues)

## Development

Requires Node.js 24 and npm 12.

```sh
npm ci
npm run verify
npm run package
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [maintainer documentation](docs/).

## License

[MIT](LICENSE). This is an independent extension and is not an official Caddy project.
