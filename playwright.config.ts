import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-smoke",
  timeout: 10_000,
  expect: {
    timeout: 3000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4183",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run build && bun scripts/serve-browser-smoke.mjs",
    url: "http://127.0.0.1:4183/browser-smoke/timing.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
