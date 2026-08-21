import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "test/integration/**", "test/web/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "packages/language-core/src/**/*.ts",
        "packages/language-server/src/{server,workspace-index}.ts",
        "packages/vscode-client/src/caddy-output.ts",
        "packages/vscode-client/src/caddy-runner.ts",
      ],
      exclude: [
        "packages/language-core/src/generated/**",
        "packages/language-server/src/{node,browser}.ts",
        "packages/vscode-client/src/{desktop,browser}.ts",
      ],
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/report",
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});

export default config;
