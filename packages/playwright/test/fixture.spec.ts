import { expect, test as base } from "@playwright/test";

import { assertHealthy, loopwatchFixture } from "../src/index";

const test = base.extend(loopwatchFixture);

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
});

test("loop.measure returns measurement with expected shape", async ({ page, loop }) => {
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });

  expect(typeof m.durationMs).toBe("number");
  expect(typeof m.lag.sampleCount).toBe("number");
  expect(typeof m.lag.p50).toBe("number");
  expect(typeof m.lag.p99).toBe("number");
  expect(typeof m.lag.blockedTimeMs).toBe("number");
  expect(Array.isArray(m.longTasks.entries)).toBe(true);
  expect(typeof m.raf.frameCount).toBe("number");
  expect(typeof m.worstWindow.blockedTimeMs).toBe("number");
});

test("calling loop.measure twice produces independent measurements", async ({ page, loop }) => {
  const first = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });
  const second = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });

  expect(first.durationMs).toBeGreaterThan(0);
  expect(second.durationMs).toBeGreaterThan(0);
  expect(second.lag.sampleCount).toBeGreaterThanOrEqual(0);
});

test("fn error propagates and subsequent measure works", async ({ page, loop }) => {
  await expect(
    loop.measure(page, async () => {
      throw new Error("intentional error");
    }),
  ).rejects.toThrow("intentional error");

  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });
  expect(m.durationMs).toBeGreaterThan(0);
});

test("assertHealthy(m, {}) does not throw", async ({ page, loop }) => {
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });
  expect(() => {
    assertHealthy(m, {});
  }).not.toThrow();
});

test("assertHealthy(m, { maxP99: -1 }) throws for any real measurement", async ({ page, loop }) => {
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });
  expect(() => {
    assertHealthy(m, { maxP99: -1 });
  }).toThrow();
});

test("RAF fields are present in the result", async ({ page, loop }) => {
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(20);
  });
  expect(typeof m.raf.frameCount).toBe("number");
  expect(typeof m.raf.estimatedFps).toBe("number");
  expect(typeof m.raf.meanFrameTimeMs).toBe("number");
  expect(typeof m.raf.p95FrameTimeMs).toBe("number");
  expect(typeof m.raf.droppedFrames).toBe("number");
});
