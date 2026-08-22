# Development container

Use **Dev Containers: Rebuild and Reopen in Container**, then run:

```sh
node --version
npm --version
bash .devcontainer/verify.sh
```

Node.js and npm are already pinned. The full check runs against pinned Caddy sources and the bundled
Caddy 2.11.4 binary. It exercises source and packaged desktop, browser, and Remote SSH hosts.

Named volumes isolate dependencies, generated output, editor downloads, and caches per Dev
Container. The host Docker socket is mounted for Remote SSH tests, so treat the container as having
control of that Docker host.
