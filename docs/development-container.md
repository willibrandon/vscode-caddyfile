# Development container

Open the repository in VS Code and choose **Dev Containers: Rebuild and Reopen in Container**. The
container includes the pinned Node.js, npm, Caddy, browser, and test tools.

```sh
node --version
npm --version
bash .devcontainer/verify.sh
```

The full check covers pinned upstream data, real Caddy, desktop, browser, packaged VSIX, Remote SSH,
and the documentation site. Dependencies, generated files, editor downloads, and caches use volumes
scoped to this Dev Container.

The container is not privileged. Remote SSH tests use the host Docker socket, which grants control
of that Docker host. CI builds, verifies, exports, and scans the same image with Picket.
