import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 15_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [["list"]],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun scripts/serve-test-pages.mjs",
    url: "http://127.0.0.1:4184/idle.html",
    reuseExistingServer: !process.env["CI"],
    timeout: 10_000,
  },
});
