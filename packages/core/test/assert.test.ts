import { describe, expect, it } from "vitest";

import { assertHealthy } from "../src/assert";

import type { LoopMonitorReport } from "../src/loop-monitor";
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

function makeMonitorReport(): LoopMonitorReport {
  return {
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
    },
    longTasks: { count: 0, totalDurationMs: 0, entries: [] },
    raf: {
      frameCount: 30,
      estimatedFps: 59.9,
      meanFrameTimeMs: 16.7,
      p95FrameTimeMs: 18,
      droppedFrames: 0,
    },
    worstWindow: { startMs: 0, endMs: 500, blockedTimeMs: 0, longTasks: [] },
    isJanky: false,
  };
}

describe("assertHealthy — no-op cases", () => {
  it("does not throw with empty thresholds", () => {
    expect(() => {
      assertHealthy(makeMeasurement(), {});
    }).not.toThrow();
  });

  it("does not throw when only unrelated thresholds are set and all values pass", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 999 } }), { maxP50: 100 });
    }).not.toThrow();
  });
});

describe("assertHealthy — boundary conditions per field", () => {
  // maxP50
  it("maxP50: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 10 } }), { maxP50: 10 });
    }).not.toThrow();
  });

  it("maxP50: throws when actual exceeds threshold by 0.001", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 10.001 } }), { maxP50: 10 });
    }).toThrow();
  });

  it("maxP50: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 5 } }), { maxP50: 10 });
    }).not.toThrow();
  });

  it("maxP50: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 0 } }), { maxP50: 0 });
    }).not.toThrow();
  });

  it("maxP50: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 0.1 } }), { maxP50: 0 });
    }).toThrow();
  });

  // maxP99
  it("maxP99: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 30 } }), { maxP99: 30 });
    }).not.toThrow();
  });

  it("maxP99: throws when actual exceeds threshold by 0.001", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 30.001 } }), { maxP99: 30 });
    }).toThrow();
  });

  it("maxP99: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 10 } }), { maxP99: 30 });
    }).not.toThrow();
  });

  it("maxP99: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 0 } }), { maxP99: 0 });
    }).not.toThrow();
  });

  it("maxP99: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 0.1 } }), { maxP99: 0 });
    }).toThrow();
  });

  // maxBlockedMs
  it("maxBlockedMs: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 100 } }), { maxBlockedMs: 100 });
    }).not.toThrow();
  });

  it("maxBlockedMs: throws when actual exceeds threshold by 0.001", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 100.001 } }), { maxBlockedMs: 100 });
    }).toThrow();
  });

  it("maxBlockedMs: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 50 } }), { maxBlockedMs: 100 });
    }).not.toThrow();
  });

  it("maxBlockedMs: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 0 } }), { maxBlockedMs: 0 });
    }).not.toThrow();
  });

  it("maxBlockedMs: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 0.1 } }), { maxBlockedMs: 0 });
    }).toThrow();
  });

  // maxSpikeCount — integer field; use integer boundary (+1) not float delta (+0.001)
  it("maxSpikeCount: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { spikeCount: 2 } }), { maxSpikeCount: 2 });
    }).not.toThrow();
  });

  it("maxSpikeCount: throws when actual exceeds threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { spikeCount: 3 } }), { maxSpikeCount: 2 });
    }).toThrow();
  });

  it("maxSpikeCount: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { spikeCount: 1 } }), { maxSpikeCount: 2 });
    }).not.toThrow();
  });

  it("maxSpikeCount: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { spikeCount: 0 } }), { maxSpikeCount: 0 });
    }).not.toThrow();
  });

  it("maxSpikeCount: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { spikeCount: 1 } }), { maxSpikeCount: 0 });
    }).toThrow();
  });

  // maxLongTasks — integer field; use integer boundary (+1) not float delta (+0.001)
  it("maxLongTasks: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 3 } }), { maxLongTasks: 3 });
    }).not.toThrow();
  });

  it("maxLongTasks: throws when actual exceeds threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 4 } }), { maxLongTasks: 3 });
    }).toThrow();
  });

  it("maxLongTasks: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 1 } }), { maxLongTasks: 3 });
    }).not.toThrow();
  });

  it("maxLongTasks: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 0 } }), { maxLongTasks: 0 });
    }).not.toThrow();
  });

  it("maxLongTasks: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 1 } }), { maxLongTasks: 0 });
    }).toThrow();
  });

  // maxDroppedFrames — integer field; use integer boundary (+1) not float delta (+0.001)
  it("maxDroppedFrames: does not throw when actual equals threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 2 } }), { maxDroppedFrames: 2 });
    }).not.toThrow();
  });

  it("maxDroppedFrames: throws when actual exceeds threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 3 } }), { maxDroppedFrames: 2 });
    }).toThrow();
  });

  it("maxDroppedFrames: does not throw when actual is below threshold", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 1 } }), { maxDroppedFrames: 2 });
    }).not.toThrow();
  });

  it("maxDroppedFrames: does not throw when threshold is 0 and actual is 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 0 } }), { maxDroppedFrames: 0 });
    }).not.toThrow();
  });

  it("maxDroppedFrames: throws when threshold is 0 and actual is above 0", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 1 } }), { maxDroppedFrames: 0 });
    }).toThrow();
  });
});

describe("assertHealthy — NaN measurement values", () => {
  it("does not throw for NaN lag.p99 (zero-sample measurement)", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: Number.NaN } }), { maxP99: 30 });
    }).not.toThrow();
  });

  it("does not throw for NaN lag.p50 (zero-sample measurement)", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: Number.NaN } }), { maxP50: 10 });
    }).not.toThrow();
  });

  it("does not throw for NaN lag.blockedTimeMs (zero-sample measurement)", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: Number.NaN } }), { maxBlockedMs: 100 });
    }).not.toThrow();
  });
});

describe("assertHealthy — multi-violation collection", () => {
  it("collects all violations before throwing", () => {
    const m = makeMeasurement({ lag: { p99: 142.3, spikeCount: 2 }, longTasks: { count: 3 } });
    const run = () => {
      assertHealthy(m, { maxP99: 30, maxSpikeCount: 1, maxLongTasks: 0 });
    };
    expect(run).toThrow("lag.p99");
    expect(run).toThrow("lag.spikeCount");
    expect(run).toThrow("longTasks.count");
  });

  it("has exactly one line per violation, each prefixed with '  - '", () => {
    const m = makeMeasurement({ lag: { p99: 142.3, spikeCount: 2 }, longTasks: { count: 3 } });
    let caught: unknown;
    try {
      assertHealthy(m, { maxP99: 30, maxSpikeCount: 1, maxLongTasks: 0 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      const lines = caught.message.split("\n").filter((l) => l.startsWith("  - "));
      expect(lines).toHaveLength(3);
    }
  });

  it("violations appear in field-definition order", () => {
    const m = makeMeasurement({
      lag: { p50: 20, p99: 142.3, blockedTimeMs: 200, spikeCount: 3 },
      longTasks: { count: 2 },
      raf: { droppedFrames: 5 },
    });
    let caught: unknown;
    try {
      assertHealthy(m, {
        maxP50: 10,
        maxP99: 30,
        maxBlockedMs: 100,
        maxSpikeCount: 1,
        maxLongTasks: 0,
        maxDroppedFrames: 2,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      const msg = caught.message;
      expect(msg.indexOf("lag.p50")).toBeLessThan(msg.indexOf("lag.p99"));
      expect(msg.indexOf("lag.p99")).toBeLessThan(msg.indexOf("lag.blockedTimeMs"));
      expect(msg.indexOf("lag.blockedTimeMs")).toBeLessThan(msg.indexOf("lag.spikeCount"));
      expect(msg.indexOf("lag.spikeCount")).toBeLessThan(msg.indexOf("longTasks.count"));
      expect(msg.indexOf("longTasks.count")).toBeLessThan(msg.indexOf("raf.droppedFrames"));
    }
  });
});

describe("assertHealthy — error message format", () => {
  it("header line starts the message and is followed immediately by a newline", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 142.3 } }), { maxP99: 30 });
    }).toThrow(/^Loop health assertion failed:\n/);
  });

  it("float fields use toFixed(1) — value with 2 non-zero decimals rounds correctly", () => {
    // 18.36 → toFixed(1)="18.4", toFixed(2)="18.36" — "18.4ms" is not a substring of "18.36ms"
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p50: 18.36 } }), { maxP50: 10 });
    }).toThrow("lag.p50 18.4ms");
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 142.36 } }), { maxP99: 30 });
    }).toThrow("lag.p99 142.4ms");
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { blockedTimeMs: 50.36 } }), { maxBlockedMs: 10 });
    }).toThrow("lag.blockedTimeMs 50.4ms");
  });

  it("integer count fields have no decimals in error message", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ longTasks: { count: 3 } }), { maxLongTasks: 0 });
    }).toThrow("longTasks.count 3 exceeds limit 0");
  });

  it("droppedFrames violation line includes advisory annotation", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ raf: { droppedFrames: 4 } }), { maxDroppedFrames: 2 });
    }).toThrow("(advisory: RAF timing is unreliable in headless environments)");
  });

  it("advisory annotation does not appear on non-droppedFrames lines", () => {
    let caught: unknown;
    try {
      assertHealthy(makeMeasurement({ lag: { p99: 142.3 } }), { maxP99: 30 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.message).not.toContain("advisory");
    }
  });
});

describe("assertHealthy — thrown value", () => {
  it("thrown value is an instance of Error", () => {
    expect(() => {
      assertHealthy(makeMeasurement({ lag: { p99: 142.3 } }), { maxP99: 30 });
    }).toThrow(Error);
  });

  it("thrown value is a plain Error, not a custom subclass", () => {
    let caught: unknown;
    try {
      assertHealthy(makeMeasurement({ lag: { p99: 142.3 } }), { maxP99: 30 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.constructor).toBe(Error);
    }
  });
});

describe("assertHealthy — type safety", () => {
  it("LoopMonitorReport is not assignable to LoopMeasurement<T> (tsc enforces this)", () => {
    // @ts-expect-error — LoopMonitorReport lacks .value, not assignable to LoopMeasurement<T>
    assertHealthy(makeMonitorReport(), {});
  });
});
