import { readFileSync } from "fs";
import { fileURLToPath } from "url";

import { expect, test } from "@playwright/test";

const harnessSource = readFileSync(
  fileURLToPath(new URL("../dist/harness.iife.js", import.meta.url)),
  "utf8",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: harnessSource });
  await page.goto("about:blank");
});

test("window.__loopwatch is defined after injection", async ({ page }) => {
  const isDefined = await page.evaluate(
    () => typeof window.__loopwatch === "object" && window.__loopwatch !== null,
  );
  expect(isDefined).toBe(true);
});

test("start then end returns measurement with expected shape", async ({ page }) => {
  const result = await page.evaluate(async () => {
    window.__loopwatch.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    return window.__loopwatch.end();
  });

  expect(typeof result.durationMs).toBe("number");
  expect(typeof result.lag.sampleCount).toBe("number");
  expect(typeof result.lag.p50).toBe("number");
  expect(typeof result.lag.p99).toBe("number");
  expect(typeof result.lag.blockedTimeMs).toBe("number");
  expect(Array.isArray(result.longTasks.entries)).toBe(true);
  expect(typeof result.raf.frameCount).toBe("number");
  expect(typeof result.worstWindow.blockedTimeMs).toBe("number");
});

test("returned object passes JSON.stringify without error", async ({ page }) => {
  const canSerialize = await page.evaluate(async () => {
    window.__loopwatch.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    const result = window.__loopwatch.end();
    try {
      JSON.stringify(result);
      return true;
    } catch {
      return false;
    }
  });
  expect(canSerialize).toBe(true);
});

test("harness resets after end — start and end again returns new measurement", async ({
  page,
}) => {
  const [first, second] = await page.evaluate(async () => {
    window.__loopwatch.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    const a = window.__loopwatch.end();

    window.__loopwatch.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    const b = window.__loopwatch.end();

    return [a, b] as const;
  });

  expect(first.durationMs).toBeGreaterThan(0);
  expect(second.durationMs).toBeGreaterThan(0);
  expect(second.lag.sampleCount).toBeGreaterThanOrEqual(0);
});

test("calling start twice is a no-op — measurement reflects full duration", async ({ page }) => {
  const result = await page.evaluate(async () => {
    window.__loopwatch.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    window.__loopwatch.start(); // second call — no-op
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    return window.__loopwatch.end();
  });

  // If second start() reset the timer, durationMs would be ~30ms.
  // A no-op means durationMs reflects the full ~60ms period.
  expect(result.durationMs).toBeGreaterThanOrEqual(40);
});

test("detects 100ms synchronous block — p99 > 50ms and blockedTimeMs > 0", async ({ page }) => {
  await page.evaluate(() => {
    window.__loopwatch.start();
  });
  // Let baseline ticks accumulate before the block
  await page.waitForTimeout(30);
  // Block the browser main thread for 100ms
  await page.evaluate(() => {
    const deadline = performance.now() + 100;
    while (performance.now() < deadline) {
      // spin
    }
  });
  // Wait for the delayed tick (queued before the spin) to fire in the browser event loop
  await page.waitForTimeout(50);
  const result = await page.evaluate(() => window.__loopwatch.end());

  expect(result.lag.p99).toBeGreaterThan(50);
  expect(result.lag.blockedTimeMs).toBeGreaterThan(0);
});
