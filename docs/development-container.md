# Development container

Open the repository in VS Code and choose **Dev Containers: Reopen in Container**. The container
uses Node.js 24 and installs the tools needed by the repository checks.

```sh
npm ci
npm run verify
```

CI builds the same container, verifies its configuration, runs the extension inside it, exports the
image, and scans that image with Picket. `.picketignore` contains only exact fingerprints confirmed
in the pinned Debian base image documentation.
