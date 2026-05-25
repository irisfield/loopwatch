import { describe, expect, it } from "vitest";

import { compareReports } from "../src/compare-reports";

import type { LoopMeasurement } from "../src/measure-lag";

function makeMeasurement(
  overrides: {
    durationMs?: number;
    lag?: Partial<LoopMeasurement<void>["lag"]>;
    longTasks?: Partial<LoopMeasurement<void>["longTasks"]>;
    raf?: Partial<LoopMeasurement<void>["raf"]>;
  } = {},
): LoopMeasurement<void> {
  return {
    value: undefined,
    durationMs: overrides.durationMs ?? 500,
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

describe("compareReports", () => {
  it("returns zero deltas when before and after are identical", () => {
    const m = makeMeasurement();
    const delta = compareReports(m, m);
    expect(delta.durationMsDelta).toBe(0);
    expect(delta.lag.p99Delta).toBe(0);
    expect(delta.lag.blockedTimeMsDelta).toBe(0);
    expect(delta.longTasks.countDelta).toBe(0);
    expect(delta.raf.droppedFramesDelta).toBe(0);
  });

  it("returns positive lag deltas when after is worse", () => {
    const before = makeMeasurement({ lag: { p99: 10, blockedTimeMs: 0, spikeCount: 0 } });
    const after = makeMeasurement({ lag: { p99: 80, blockedTimeMs: 150, spikeCount: 3 } });
    const delta = compareReports(before, after);
    expect(delta.lag.p99Delta).toBe(70);
    expect(delta.lag.blockedTimeMsDelta).toBe(150);
    expect(delta.lag.spikeCountDelta).toBe(3);
  });

  it("returns negative lag deltas when after is better", () => {
    const before = makeMeasurement({ lag: { p99: 80, blockedTimeMs: 150, spikeCount: 3 } });
    const after = makeMeasurement({ lag: { p99: 10, blockedTimeMs: 0, spikeCount: 0 } });
    const delta = compareReports(before, after);
    expect(delta.lag.p99Delta).toBe(-70);
    expect(delta.lag.blockedTimeMsDelta).toBe(-150);
    expect(delta.lag.spikeCountDelta).toBe(-3);
  });

  it("computes deltas for all lag fields", () => {
    const before = makeMeasurement();
    const after = makeMeasurement({
      durationMs: 510,
      lag: { sampleCount: 105, min: 2, max: 20, mean: 5, p50: 4, p95: 15, p99: 20 },
    });
    const delta = compareReports(before, after);
    expect(delta.durationMsDelta).toBe(10);
    expect(delta.lag.sampleCountDelta).toBe(5);
    expect(delta.lag.minDelta).toBe(1);
    expect(delta.lag.maxDelta).toBe(10);
    expect(delta.lag.meanDelta).toBe(2);
    expect(delta.lag.p50Delta).toBe(2);
    expect(delta.lag.p95Delta).toBe(7);
    expect(delta.lag.p99Delta).toBe(10);
  });

  it("computes deltas for longTasks fields", () => {
    const before = makeMeasurement({ longTasks: { count: 0, totalDurationMs: 0 } });
    const after = makeMeasurement({ longTasks: { count: 3, totalDurationMs: 250 } });
    const delta = compareReports(before, after);
    expect(delta.longTasks.countDelta).toBe(3);
    expect(delta.longTasks.totalDurationMsDelta).toBe(250);
  });

  it("computes deltas for raf fields", () => {
    const before = makeMeasurement({
      raf: {
        frameCount: 30,
        estimatedFps: 59.9,
        meanFrameTimeMs: 16.7,
        p95FrameTimeMs: 18,
        droppedFrames: 0,
      },
    });
    const after = makeMeasurement({
      raf: {
        frameCount: 25,
        estimatedFps: 50,
        meanFrameTimeMs: 20,
        p95FrameTimeMs: 30,
        droppedFrames: 5,
      },
    });
    const delta = compareReports(before, after);
    expect(delta.raf.frameCountDelta).toBe(-5);
    expect(delta.raf.droppedFramesDelta).toBe(5);
    expect(delta.raf.estimatedFpsDelta).toBeCloseTo(-9.9, 1);
    expect(delta.raf.meanFrameTimeMsDelta).toBeCloseTo(3.3, 1);
  });
});
