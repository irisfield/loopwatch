import { describe, expect, it } from "vitest";

import { summary } from "../src/summary";

import type { LoopMeasurement } from "../src/measure-lag";

interface TestLoafEntry extends PerformanceEntry {
  scripts: { sourceFunctionName?: string; sourceURL?: string }[];
}

function makeEntry(overrides: Partial<PerformanceEntry> = {}): PerformanceEntry {
  return {
    name: "longtask",
    entryType: "longtask",
    startTime: 0,
    duration: 50,
    toJSON: () => ({}),
    ...overrides,
  };
}

function makeLoafEntry(scripts: TestLoafEntry["scripts"]): TestLoafEntry {
  return {
    name: "long-animation-frame",
    entryType: "long-animation-frame",
    startTime: 218,
    duration: 142,
    toJSON: () => ({}),
    scripts,
  };
}

function makeMeasurement(
  overrides: {
    durationMs?: number;
    lag?: Partial<LoopMeasurement<void>["lag"]>;
    longTasks?: Partial<LoopMeasurement<void>["longTasks"]>;
    worstWindow?: Partial<LoopMeasurement<void>["worstWindow"]>;
  } = {},
): LoopMeasurement<void> {
  return {
    value: undefined,
    durationMs: overrides.durationMs ?? 523,
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
    },
    worstWindow: {
      startMs: 0,
      endMs: 500,
      blockedTimeMs: 0,
      longTasks: [],
      ...overrides.worstWindow,
    },
  };
}

describe("summary", () => {
  it("returns a correctly formatted string for a healthy measurement", () => {
    const m = makeMeasurement({
      durationMs: 523,
      lag: { p50: 1.4, p99: 4.3 },
      longTasks: { count: 0 },
      worstWindow: { blockedTimeMs: 0, startMs: 0, longTasks: [] },
    });
    expect(summary(m)).toBe(
      "523ms total · p50=1ms p99=4ms · 0 long task(s) · worst: 0ms blocked at t=0ms",
    );
  });

  it("renders NaN lag.p50 as em dash", () => {
    expect(summary(makeMeasurement({ lag: { p50: Number.NaN } }))).toContain("p50=—ms");
  });

  it("renders NaN lag.p99 as em dash", () => {
    expect(summary(makeMeasurement({ lag: { p99: Number.NaN } }))).toContain("p99=—ms");
  });

  it("does not throw when all lag fields are NaN", () => {
    expect(() => {
      summary(
        makeMeasurement({
          lag: {
            p50: Number.NaN,
            p99: Number.NaN,
            p95: Number.NaN,
            min: Number.NaN,
            max: Number.NaN,
            mean: Number.NaN,
          },
        }),
      );
    }).not.toThrow();
  });

  it("renders zero long tasks as '0 long task(s)'", () => {
    expect(summary(makeMeasurement({ longTasks: { count: 0 } }))).toContain("0 long task(s)");
  });

  it("renders worstWindow.blockedTimeMs 0 as '0ms blocked'", () => {
    expect(summary(makeMeasurement({ worstWindow: { blockedTimeMs: 0 } }))).toContain(
      "0ms blocked",
    );
  });

  it("rounds durationMs to the nearest integer", () => {
    expect(summary(makeMeasurement({ durationMs: 523.7 }))).toContain("524ms total");
  });

  it("rounds lag values to the nearest integer", () => {
    const result = summary(makeMeasurement({ lag: { p50: 2.6, p99: 142.3 } }));
    expect(result).toContain("p50=3ms");
    expect(result).toContain("p99=142ms");
  });

  it("appends LoAF attribution when scripts[0] has sourceFunctionName and sourceURL", () => {
    const entry = makeLoafEntry([
      {
        sourceFunctionName: "encryptPayload",
        sourceURL: "https://example.com/static/js/checkout.js",
      },
    ]);
    const m = makeMeasurement({
      worstWindow: { startMs: 218, blockedTimeMs: 142, longTasks: [entry] },
    });
    expect(summary(m)).toContain("(encryptPayload in checkout.js)");
  });

  it("extracts basename from sourceURL", () => {
    const entry = makeLoafEntry([
      { sourceFunctionName: "fn", sourceURL: "https://example.com/static/js/checkout.js" },
    ]);
    const result = summary(makeMeasurement({ worstWindow: { longTasks: [entry] } }));
    expect(result).toContain("checkout.js");
    expect(result).not.toContain("example.com");
  });

  it("omits attribution suffix when scripts array is empty", () => {
    const entry = makeLoafEntry([]);
    const m = makeMeasurement({ worstWindow: { longTasks: [entry] } });
    expect(summary(m)).not.toContain(" in ");
  });

  it("omits attribution suffix when entry has no scripts property", () => {
    const entry = makeEntry({ entryType: "longtask", startTime: 218, duration: 142 });
    const m = makeMeasurement({ worstWindow: { longTasks: [entry] } });
    expect(summary(m)).not.toContain(" in ");
  });

  it("omits attribution suffix when sourceFunctionName is absent", () => {
    const entry = makeLoafEntry([{ sourceURL: "https://example.com/checkout.js" }]);
    const m = makeMeasurement({ worstWindow: { longTasks: [entry] } });
    expect(summary(m)).not.toContain(" in ");
  });

  it("omits attribution suffix when sourceURL is absent", () => {
    const entry = makeLoafEntry([{ sourceFunctionName: "encryptPayload" }]);
    const m = makeMeasurement({ worstWindow: { longTasks: [entry] } });
    expect(summary(m)).not.toContain(" in ");
  });
});
