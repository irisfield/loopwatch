import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Fixtures, type Page } from "@playwright/test";
import { assertHealthy as coreAssertHealthy, type HealthThresholds } from "loopwatch/assert";

import type { SerializedLoopMeasurement } from "loopwatch/serialization";

export type { HealthThresholds } from "loopwatch/assert";
export type { SerializedLoopMeasurement } from "loopwatch/serialization";

const harnessSource = readFileSync(
  fileURLToPath(new URL("../dist/harness.iife.js", import.meta.url)),
  "utf8",
);

const NAV_ERROR =
  "loopwatch: page navigated inside fn() — measurement is invalid. " +
  "Pass only user interactions to fn(), not navigations.";

function assertPlainObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(
      `loopwatch: invalid measurement from CDP — ${field} must be a plain object, got ${String(value)}`,
    );
  }
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `loopwatch: invalid measurement from CDP — ${field} must be a finite number, got ${String(value)}`,
    );
  }
}

function assertArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `loopwatch: invalid measurement from CDP — ${field} must be an array, got ${String(value)}`,
    );
  }
}

function assertValidMeasurement(value: unknown): asserts value is SerializedLoopMeasurement {
  assertPlainObject(value, "measurement");
  assertFiniteNumber(value.durationMs, "durationMs");

  const lag = value.lag;
  assertPlainObject(lag, "lag");
  assertFiniteNumber(lag.sampleCount, "lag.sampleCount");
  assertFiniteNumber(lag.min, "lag.min");
  assertFiniteNumber(lag.max, "lag.max");
  assertFiniteNumber(lag.mean, "lag.mean");
  assertFiniteNumber(lag.p50, "lag.p50");
  assertFiniteNumber(lag.p95, "lag.p95");
  assertFiniteNumber(lag.p99, "lag.p99");
  assertFiniteNumber(lag.blockedTimeMs, "lag.blockedTimeMs");
  assertFiniteNumber(lag.spikeCount, "lag.spikeCount");

  const longTasks = value.longTasks;
  assertPlainObject(longTasks, "longTasks");
  assertFiniteNumber(longTasks.count, "longTasks.count");
  assertFiniteNumber(longTasks.totalDurationMs, "longTasks.totalDurationMs");
  assertArray(longTasks.entries, "longTasks.entries");

  const raf = value.raf;
  assertPlainObject(raf, "raf");
  assertFiniteNumber(raf.frameCount, "raf.frameCount");
  assertFiniteNumber(raf.estimatedFps, "raf.estimatedFps");
  assertFiniteNumber(raf.meanFrameTimeMs, "raf.meanFrameTimeMs");
  assertFiniteNumber(raf.p95FrameTimeMs, "raf.p95FrameTimeMs");
  assertFiniteNumber(raf.droppedFrames, "raf.droppedFrames");

  const worstWindow = value.worstWindow;
  assertPlainObject(worstWindow, "worstWindow");
  assertFiniteNumber(worstWindow.startMs, "worstWindow.startMs");
  assertFiniteNumber(worstWindow.endMs, "worstWindow.endMs");
  assertFiniteNumber(worstWindow.blockedTimeMs, "worstWindow.blockedTimeMs");
  assertArray(worstWindow.longTasks, "worstWindow.longTasks");
}

export function assertHealthy(
  measurement: SerializedLoopMeasurement,
  thresholds: HealthThresholds,
): void {
  coreAssertHealthy(measurement, thresholds);
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

  const raw: unknown = await page.evaluate(() => {
    const h = globalThis.__loopwatch;
    if (!h) throw new Error("loopwatch harness not installed");
    return h.end();
  });
  assertValidMeasurement(raw);
  return raw;
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
