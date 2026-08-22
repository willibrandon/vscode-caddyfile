# Testing

Use Node.js 24 and npm 12.

```sh
npm ci
npm run verify
```

`verify` runs formatting, lint, strict types, unit and property tests, coverage, performance gates,
bundle checks, license policy, package allowlists, npm audit, and signature audit.

| Command                         | Scope                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| `npm test`                      | Language core, server, client, grammar, and package contracts |
| `npm run test:integration`      | Desktop extension host                                        |
| `npm run test:web`              | Browser Worker extension host                                 |
| `npm run test:vsix`             | Clean install and activation of the exact VSIX                |
| `npm run test:remote`           | Exact VSIX through Remote SSH                                 |
| `npm run test:docs`             | Site build, packaged grammar, and popup viewport matrix       |
| `npm run check:caddy:formatter` | Byte comparison with pinned Caddy formatter cases             |

CI tests minimum and current VS Code on Linux, macOS, and Windows. It also tests Insiders, browser,
Remote SSH, the development container, pinned upstream fixtures, CodeQL, dependency review, Picket,
secret scanning, and artifact reproduction.

Generated bundles, coverage, downloaded hosts, test profiles, and VSIX files are ignored outputs.
