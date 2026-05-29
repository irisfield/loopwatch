import { describe, expect, it } from "vitest";

import { serializeEntry, serializeMeasurement } from "../src/serialization";

import type { LagReport, LoopMeasurement, RafBlock } from "../src/measure-lag";

function makeLongtaskEntry(overrides: Partial<PerformanceEntry> = {}): PerformanceEntry {
  return {
    name: "longtask",
    entryType: "longtask",
    startTime: 0,
    duration: 100,
    toJSON: () => ({}),
    ...overrides,
  };
}

function makeLoafEntry(): PerformanceLongAnimationFrameTiming {
  return {
    name: "long-animation-frame",
    entryType: "long-animation-frame",
    startTime: 100,
    duration: 200,
    toJSON: () => ({}),
    renderStart: 150,
    styleAndLayoutStart: 160,
    firstUIEventTimestamp: 100,
    blockingDuration: 200,
    scripts: [
      {
        name: "",
        entryType: "script",
        startTime: 100,
        duration: 50,
        toJSON: () => ({}),
        sourceURL: "https://example.com/app.js",
        sourceFunctionName: "handleClick",
        sourceCharPosition: 42,
        invokerType: "event-listener",
        windowAttribution: "self",
        executionStart: 105,
        pauseDuration: 0,
        forcedStyleAndLayoutDuration: 0,
      },
    ],
  };
}

const LAG: LagReport = {
  sampleCount: 100,
  min: 1,
  max: 10,
  mean: 3,
  p50: 2,
  p95: 8,
  p99: 10,
  blockedTimeMs: 0,
  spikeCount: 0,
};

const RAF: RafBlock = {
  frameCount: 30,
  estimatedFps: 59.9,
  meanFrameTimeMs: 16.7,
  p95FrameTimeMs: 18,
  droppedFrames: 0,
};

function makeMeasurement(
  overrides: {
    longTaskEntries?: PerformanceEntry[];
    worstWindowEntries?: PerformanceEntry[];
  } = {},
): Omit<LoopMeasurement<void>, "value"> {
  return {
    durationMs: 523,
    lag: LAG,
    raf: RAF,
    longTasks: {
      count: overrides.longTaskEntries?.length ?? 0,
      totalDurationMs: 0,
      entries: overrides.longTaskEntries ?? [],
    },
    worstWindow: {
      startMs: 0,
      endMs: 500,
      blockedTimeMs: 0,
      longTasks: overrides.worstWindowEntries ?? [],
    },
  };
}

describe("serializeEntry", () => {
  it("returns only base fields for a longtask entry", () => {
    expect(serializeEntry(makeLongtaskEntry())).toEqual({
      name: "longtask",
      entryType: "longtask",
      startTime: 0,
      duration: 100,
    });
  });

  it("includes scripts and blockingDuration for a long-animation-frame entry", () => {
    const result = serializeEntry(makeLoafEntry());
    expect(result.entryType).toBe("long-animation-frame");
    expect(result.blockingDuration).toBe(200);
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts?.[0]?.sourceFunctionName).toBe("handleClick");
    expect(result.scripts?.[0]?.sourceURL).toBe("https://example.com/app.js");
  });

  it("returns base fields only for an unknown entry type and does not throw", () => {
    const entry: PerformanceEntry = {
      name: "paint",
      entryType: "paint",
      startTime: 50,
      duration: 0,
      toJSON: () => ({}),
    };
    expect(serializeEntry(entry)).toEqual({
      name: "paint",
      entryType: "paint",
      startTime: 50,
      duration: 0,
    });
  });
});

describe("serializeMeasurement", () => {
  it("produces plain objects with no PerformanceEntry instances", () => {
    const entry = makeLongtaskEntry();
    const result = serializeMeasurement(
      makeMeasurement({ longTaskEntries: [entry], worstWindowEntries: [entry] }),
    );
    expect(result.longTasks.entries[0]).not.toHaveProperty("toJSON");
    expect(result.worstWindow.longTasks[0]).not.toHaveProperty("toJSON");
    expect(result.longTasks.entries[0]).not.toBe(entry);
  });

  it("output passes JSON.stringify without throwing", () => {
    const m = makeMeasurement({
      longTaskEntries: [makeLongtaskEntry()],
      worstWindowEntries: [makeLoafEntry()],
    });
    expect(() => JSON.stringify(serializeMeasurement(m))).not.toThrow();
  });

  it("lag and raf fields are structurally identical in input and output", () => {
    const result = serializeMeasurement(makeMeasurement());
    expect(result.lag).toEqual(LAG);
    expect(result.raf).toEqual(RAF);
  });
});
