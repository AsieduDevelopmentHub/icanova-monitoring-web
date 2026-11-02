import { defineConfig } from "vitest/config";

process.env.ALLOW_SELF_SERVE_ORGS ??= "1";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
