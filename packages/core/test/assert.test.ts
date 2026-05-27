import { describe, expect, it } from "vitest";

import { assertHealthy } from "../src/assert";

import type { LoopMeasurement } from "../src/measure-lag";

function makeMeasurement(
  overrides: {
    lag?: Partial<LoopMeasurement<void>["lag"]>;
    longTasks?: Partial<LoopMeasurement<void>["longTasks"]>;
    raf?: Partial<LoopMeasurement<void>["raf"]>;
  } = {},
): LoopMeasurement<void> {
  return {
    value: undefined,
    durationMs: 500,
    lag: {
      sampleCount: 100,
      min: 1,
      max: 10,
      mean: 3,
      p50: 2,
      p95: 8,
      p99: 10,
      blockedTimeMs: 0,
      spikeCount: 0,
      ...overrides.lag,
    },
    longTasks: {
      count: 0,
      totalDurationMs: 0,
      entries: [],
      ...overrides.longTasks,
    },
    raf: {
      frameCount: 30,
      estimatedFps: 59.9,
      meanFrameTimeMs: 16.7,
      p95FrameTimeMs: 18,
      droppedFrames: 0,
      ...overrides.raf,
    },
    worstWindow: { startMs: 0, endMs: 500, blockedTimeMs: 0, longTasks: [] },
  };
}

describe("assertHealthy", () => {
  it("does not throw with empty thresholds", () => {
    expect(() => {
      assertHealthy(makeMeasurement(), {});
    }).not.toThrow();
  });

  it("throws when lag.p99 exceeds limit", () => {
    const m = makeMeasurement({ lag: { p99: 142.3 } });
    expect(() => {
      assertHealthy(m, { maxP99: 30 });
    }).toThrow("Loop health assertion failed:");
  });

  it("does not throw when lag.p99 equals limit exactly", () => {
    const m = makeMeasurement({ lag: { p99: 30 } });
    expect(() => {
      assertHealthy(m, { maxP99: 30 });
    }).not.toThrow();
  });

  it("error message contains Loop health assertion failed header", () => {
    const m = makeMeasurement({ lag: { p99: 142.3 } });
    expect(() => {
      assertHealthy(m, { maxP99: 30 });
    }).toThrow("Loop health assertion failed:");
  });
});
