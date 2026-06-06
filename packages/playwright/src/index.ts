import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Fixtures, type Page } from "@playwright/test";
import { assertHealthy as coreAssertHealthy, type HealthThresholds } from "loopwatch/assert";

import type { SerializedLoopMeasurement } from "loopwatch/serialization";

export type { HealthThresholds } from "loopwatch/assert";
export type { SerializedLoopMeasurement as LoopMeasurement } from "loopwatch/serialization";

const harnessSource = readFileSync(
  fileURLToPath(new URL("../dist/harness.iife.js", import.meta.url)),
  "utf8",
);

const NAV_ERROR =
  "loopwatch: page navigated inside fn() — measurement is invalid. " +
  "Pass only user interactions to fn(), not navigations.";

export function assertHealthy(
  measurement: SerializedLoopMeasurement,
  thresholds: HealthThresholds,
): void {
  coreAssertHealthy(
    {
      value: undefined,
      durationMs: measurement.durationMs,
      lag: measurement.lag,
      raf: measurement.raf,
      longTasks: {
        count: measurement.longTasks.count,
        totalDurationMs: measurement.longTasks.totalDurationMs,
        entries: [],
      },
      worstWindow: {
        startMs: measurement.worstWindow.startMs,
        endMs: measurement.worstWindow.endMs,
        blockedTimeMs: measurement.worstWindow.blockedTimeMs,
        longTasks: [],
      },
    },
    thresholds,
  );
}

async function measureWithPage(
  page: Page,
  fn: () => Promise<void>,
): Promise<SerializedLoopMeasurement> {
  await page.evaluate(() => {
    const h = globalThis.__loopwatch;
    if (!h) throw new Error("loopwatch harness not installed");
    h.end();
    h.start();
  });

  const nav = { detected: false };
  const onLoad = () => {
    nav.detected = true;
  };
  page.on("load", onLoad);

  try {
    await fn();
  } catch (error) {
    page.off("load", onLoad);
    if (nav.detected) {
      throw new Error(NAV_ERROR);
    }
    throw error;
  }
  page.off("load", onLoad);

  if (nav.detected) {
    throw new Error(NAV_ERROR);
  }

  // yield one task so pending PerformanceObserver callbacks (longtask) fire before h.end()
  await page.waitForTimeout(50);

  return page.evaluate(() => {
    const h = globalThis.__loopwatch;
    if (!h) throw new Error("loopwatch harness not installed");
    return h.end();
  });
}

export interface LoopFixture {
  loop: {
    measure(page: Page, fn: () => Promise<void>): Promise<SerializedLoopMeasurement>;
  };
}

export const loopwatchFixture: Fixtures<LoopFixture, Record<never, never>, { page: Page }> = {
  loop: async ({ page }, use) => {
    await page.addInitScript({ content: harnessSource });
    // inject into the already-loaded page (about:blank) so measure() works
    // without a preceding page.goto(); addInitScript covers future navigations
    await page.evaluate(harnessSource);
    await use({ measure: measureWithPage });
  },
};
