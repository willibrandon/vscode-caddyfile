# Upstream data

`upstream-lock.json` records the reviewed Caddy, Caddy website, and tree-sitter revisions. The
extension does not download upstream data at runtime.

Vendored fixtures cover the stable Caddy adapter and formatter corpus, current Caddy regressions,
tree-sitter cases, and applicable historical extension issues. Their licenses and source paths are
recorded with the fixtures and in `THIRD-PARTY-NOTICES.md`.

## Commands

```sh
npm run fixtures:caddy:formatter
npm run fixtures:caddy:corpus
npm run fixtures:caddy:registry
npm run fixtures:tree-sitter:corpus
npm run check:caddy:formatter
```

The sync commands require the reviewed sibling checkouts. Review every generated diff and keep new
behavior covered by focused tests. Never update a pin and its expected output without checking the
upstream source and license.
