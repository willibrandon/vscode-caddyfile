# Contributing

Use Node.js 24 and npm 12.

```sh
npm ci
npm run verify
```

Use `npm run test:integration`, `npm run test:web`, or `npm run test:remote` when a change affects
those hosts. Include focused tests with fixes.

Open an issue before making a large behavioral change. See [docs/testing.md](docs/testing.md) and
[docs/upstream-data.md](docs/upstream-data.md) for fixture and pin updates.
