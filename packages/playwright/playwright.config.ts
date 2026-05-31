import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 15_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: [["list"]],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
