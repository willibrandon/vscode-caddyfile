#!/usr/bin/env bash

set -euo pipefail

readonly workspace_root="$(git rev-parse --show-toplevel)"
readonly expected_mounts=(
  "$workspace_root/node_modules"
  "$workspace_root/dist"
  "$workspace_root/coverage"
  "$workspace_root/.vscode-test"
  "$workspace_root/.vscode-test-web"
  "$workspace_root/packages/language-core/lib"
  "$workspace_root/packages/language-server/lib"
  "$workspace_root/packages/vscode-client/lib"
  "$workspace_root/docs-site/node_modules"
  "$workspace_root/docs-site/dist"
  "$workspace_root/docs-site/.astro"
  "/home/vscode/.npm"
  "/home/vscode/.cache"
)

test "$(node --version)" = "v24.19.0"
test "$(npm --version)" = "12.0.2"
test "$(node -p 'process.platform')" = "linux"
test "$(caddy version | cut -d ' ' -f 1)" = "v2.11.4"
command -v chromium >/dev/null
command -v caddy >/dev/null
command -v git >/dev/null
command -v jq >/dev/null
command -v docker >/dev/null
command -v ssh >/dev/null
command -v xvfb-run >/dev/null
command -v xauth >/dev/null

for directory in "${expected_mounts[@]}"; do
  mountpoint --quiet "$directory"
done

test -S /var/run/docker-host.sock
test "$(git -C "$CADDY_CURRENT_SOURCE" rev-parse HEAD)" = "19be5d8c587ae081957ce967e43cdb028df9e0ba"
test "$(git -C "$CADDY_STABLE_SOURCE" rev-parse v2.11.4^{commit})" = "e2eee6a7fce366321294c9c2a79f3146891dcbdf"
test "$(git -C "$CADDY_WEBSITE_SOURCE" rev-parse HEAD)" = "15ac087cfd9c21a53b2ddfa10359fdc63d5ec9b6"
test "$(git -C "$TREE_SITTER_CADDYFILE_SOURCE" rev-parse HEAD)" = "90e0a0c6e82ccc59fc2320a3ad71b4edb93c15f3"

docker version
npm run check:upstream
npm run check:caddy:formatter
npm run verify
npm run test:integration
npm run test:web
npm run package
npm run test:vsix:prepared
npm run test:remote:prepared
npm run test:docs
