import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests for the pure game engine. E2E (browser) tests live under tests/e2e
    // and are run separately with Playwright.
    include: ["server/**/*.test.ts"],
    environment: "node",
  },
});
