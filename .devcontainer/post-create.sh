#!/usr/bin/env bash

set -euo pipefail

readonly workspace_root="$(pwd -P)"
readonly owner="$(id -u):$(id -g)"
readonly upstream_root="/home/vscode/.cache/vscode-caddyfile"
readonly caddy_root="$upstream_root/caddy"
readonly website_root="$upstream_root/website"
readonly tree_sitter_root="$upstream_root/tree-sitter-caddyfile"
readonly caddy_stable_revision="e2eee6a7fce366321294c9c2a79f3146891dcbdf"
readonly caddy_current_revision="19be5d8c587ae081957ce967e43cdb028df9e0ba"
readonly website_revision="15ac087cfd9c21a53b2ddfa10359fdc63d5ec9b6"
readonly tree_sitter_revision="90e0a0c6e82ccc59fc2320a3ad71b4edb93c15f3"
readonly tree_sitter_pull_revision="9d3af6ae44ea5f9015bc2c9a5a02066c192ab627"
readonly isolated_directories=(
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

for directory in "${isolated_directories[@]}"; do
  sudo chown "$owner" "$directory"
done

initialize_repository() {
  local directory="$1"
  local repository="$2"
  if [[ "$(git -C "$directory" remote get-url origin 2>/dev/null || true)" == "$repository" ]]; then
    return
  fi
  mkdir -p "$directory"
  find "$directory" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  git -C "$directory" init --quiet
  git -C "$directory" remote add origin "$repository"
}

initialize_repository "$caddy_root" https://github.com/caddyserver/caddy.git
git -C "$caddy_root" fetch --depth 1 --no-tags origin "$caddy_current_revision" "$caddy_stable_revision"
git -C "$caddy_root" fetch --depth 1 origin refs/tags/v2.11.4:refs/tags/v2.11.4
git -C "$caddy_root" checkout --detach --force "$caddy_current_revision"

initialize_repository "$website_root" https://github.com/caddyserver/website.git
git -C "$website_root" fetch --depth 1 --no-tags origin "$website_revision"
git -C "$website_root" checkout --detach --force "$website_revision"

initialize_repository "$tree_sitter_root" https://github.com/caddyserver/tree-sitter-caddyfile.git
git -C "$tree_sitter_root" fetch --depth 1 --no-tags origin "$tree_sitter_revision"
git -C "$tree_sitter_root" fetch --depth 1 --no-tags origin pull/64/head
git -C "$tree_sitter_root" checkout --detach --force "$tree_sitter_revision"

test "$(git -C "$caddy_root" rev-parse HEAD)" = "$caddy_current_revision"
test "$(git -C "$caddy_root" rev-parse v2.11.4^{commit})" = "$caddy_stable_revision"
test "$(git -C "$website_root" rev-parse HEAD)" = "$website_revision"
test "$(git -C "$tree_sitter_root" rev-parse HEAD)" = "$tree_sitter_revision"
test "$(git -C "$tree_sitter_root" rev-parse FETCH_HEAD)" = "$tree_sitter_pull_revision"

npm ci
npm --prefix docs-site ci
node --version
npm --version
caddy version
