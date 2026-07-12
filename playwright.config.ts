import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive the real app (Next.js + Socket.IO) in a browser.
// The dev server is started automatically (or reused if already running).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Use the production server for E2E: far lighter than dev-mode compilation,
    // which matters on resource-constrained machines. Run `npm run build` first.
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
