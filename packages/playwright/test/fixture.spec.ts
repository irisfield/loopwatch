import { expect, test as base } from "@playwright/test";

import { assertHealthy, loopwatchFixture } from "../src/index";

const test = base.extend(loopwatchFixture);

// Baseline: idle page

test("idle page — durationMs > 0 and all required fields present", async ({ page, loop }) => {
  await page.goto("http://127.0.0.1:4184/idle.html");
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(200);
  });

  expect(m.durationMs).toBeGreaterThan(0);
  expect(typeof m.lag.sampleCount).toBe("number");
  expect(typeof m.lag.p50).toBe("number");
  expect(typeof m.lag.p99).toBe("number");
  expect(typeof m.lag.blockedTimeMs).toBe("number");
  expect(typeof m.longTasks.count).toBe("number");
  expect(Array.isArray(m.longTasks.entries)).toBe(true);
  expect(typeof m.raf.frameCount).toBe("number");
  expect(typeof m.worstWindow.blockedTimeMs).toBe("number");
});

test("idle page — assertHealthy(m, {}) does not throw", async ({ page, loop }) => {
  await page.goto("http://127.0.0.1:4184/idle.html");
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(200);
  });
  expect(() => {
    assertHealthy(m, {});
  }).not.toThrow();
});

// Blocking interaction

test("blocker.html — clicking #block produces lag.p99 > 50 and blockedTimeMs > 0", async ({
  page,
  loop,
}) => {
  await page.goto("http://127.0.0.1:4184/blocker.html");
  const m = await loop.measure(page, async () => {
    await page.click("#block");
  });
  expect(m.lag.p99).toBeGreaterThan(50);
  expect(m.lag.blockedTimeMs).toBeGreaterThan(0);
});

test("blocker.html — clicking #block produces longTasks.count >= 1", async ({ page, loop }) => {
  await page.goto("http://127.0.0.1:4184/blocker.html");
  const m = await loop.measure(page, async () => {
    await page.click("#block");
  });
  expect(m.longTasks.count).toBeGreaterThanOrEqual(1);
});

test("blocker.html — assertHealthy throws and message names the violation", async ({
  page,
  loop,
}) => {
  await page.goto("http://127.0.0.1:4184/blocker.html");
  const m = await loop.measure(page, async () => {
    await page.click("#block");
  });

  let caught: unknown;
  try {
    assertHealthy(m, { maxLongTasks: 0 });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  if (caught instanceof Error) {
    expect(caught.message).toContain("longTasks.count");
    expect(caught.message).toContain("exceeds limit 0");
  }
});

// Clean interaction

test("clean.html — clicking #go passes generous health thresholds", async ({ page, loop }) => {
  await page.goto("http://127.0.0.1:4184/clean.html");
  const m = await loop.measure(page, async () => {
    await page.click("#go");
  });
  expect(() => {
    assertHealthy(m, { maxP99: 50, maxBlockedMs: 0 });
  }).not.toThrow();
});

// Multiple measurements

test("two consecutive measures on blocker.html are independent and both show blocking", async ({
  page,
  loop,
}) => {
  await page.goto("http://127.0.0.1:4184/blocker.html");
  const first = await loop.measure(page, async () => {
    await page.click("#block");
  });
  const second = await loop.measure(page, async () => {
    await page.click("#block");
  });
  expect(first.durationMs).toBeGreaterThan(0);
  expect(second.durationMs).toBeGreaterThan(0);
  expect(first.lag.p99).toBeGreaterThan(50);
  expect(second.lag.p99).toBeGreaterThan(50);
});

// Error propagation

test("fn error propagates and subsequent measure works", async ({ page, loop }) => {
  await page.goto("http://127.0.0.1:4184/idle.html");
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

// Advisory RAF fields

test("RAF fields are always present (values not asserted — advisory in headless)", async ({
  page,
  loop,
}) => {
  // RAF timing is advisory in headless; assert presence only, not values
  await page.goto("http://127.0.0.1:4184/idle.html");
  const m = await loop.measure(page, async () => {
    await page.waitForTimeout(50);
  });
  expect(typeof m.raf.frameCount).toBe("number");
  expect(typeof m.raf.estimatedFps).toBe("number");
  expect(typeof m.raf.meanFrameTimeMs).toBe("number");
  expect(typeof m.raf.p95FrameTimeMs).toBe("number");
  expect(typeof m.raf.droppedFrames).toBe("number");
});
