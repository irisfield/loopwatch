import { expect, test } from "@playwright/test";

interface LagReport {
  sampleCount: number;
  max: number;
  p95: number;
}

interface RafReport {
  frameCount: number;
  estimatedFps: number;
  meanFrameTimeMs: number;
}

interface LongTaskSnapshot {
  duration: number;
  entryType: string;
  name: string;
}

declare global {
  var loopwatchSmoke: {
    blockedLag: () => Promise<LagReport>;
    longTask: () => Promise<LongTaskSnapshot[]>;
    raf: () => Promise<RafReport>;
    timeoutLag: () => Promise<number>;
  };

  interface Window {
    loopwatchSmoke: {
      blockedLag: () => Promise<LagReport>;
      longTask: () => Promise<LongTaskSnapshot[]>;
      raf: () => Promise<RafReport>;
      timeoutLag: () => Promise<number>;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/browser-smoke/timing.html");
  await expect.poll(() => page.evaluate(() => typeof globalThis.loopwatchSmoke)).toBe("object");
});

test("uses real requestAnimationFrame cadence in Chromium", async ({ page }) => {
  const report = await page.evaluate(() => globalThis.loopwatchSmoke.raf());

  expect(report.frameCount).toBeGreaterThanOrEqual(2);
  expect(report.estimatedFps).toBeGreaterThan(0);
  expect(report.meanFrameTimeMs).toBeGreaterThan(0);
});

test("uses real setTimeout timing and detects an intentional event-loop block", async ({ page }) => {
  const timeoutDelay = await page.evaluate(() => globalThis.loopwatchSmoke.timeoutLag());
  expect(timeoutDelay).toBeGreaterThanOrEqual(20);

  const report = await page.evaluate(() => globalThis.loopwatchSmoke.blockedLag());
  expect(report.sampleCount).toBeGreaterThan(0);
  expect(report.max).toBeGreaterThanOrEqual(70);
  expect(report.p95).toBeGreaterThan(0);
});

test("observes a real browser long task after blocking the main thread", async ({ page }) => {
  const entries = await page.evaluate(() => globalThis.loopwatchSmoke.longTask());

  expect(entries.length).toBeGreaterThan(0);
  expect(
    entries.some(
      (entry) =>
        (entry.entryType === "longtask" || entry.entryType === "long-animation-frame") &&
        entry.duration >= 50,
    ),
  ).toBe(true);
});
