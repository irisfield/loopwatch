import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoopMonitor, type LoopMonitorReport } from "../src/loop-monitor";

let capturedCallback: (list: PerformanceObserverEntryList) => void =
  vi.fn<(list: PerformanceObserverEntryList) => void>();
let mockObserve: Mock<(options?: PerformanceObserverInit) => void>;
let mockDisconnect: Mock<() => void>;

function makeEntry(duration: number, startTime = 0): PerformanceEntry {
  return {
    duration,
    startTime,
    name: "longtask",
    entryType: "longtask",
    toJSON: () => ({}),
  };
}

function dispatchEntries(entries: PerformanceEntry[]): void {
  const list: PerformanceObserverEntryList = {
    getEntries: () => entries,
    getEntriesByName: () => entries,
    getEntriesByType: () => entries,
  };
  capturedCallback(list);
}

function missingReportResolver(): never {
  throw new Error("report resolver was not initialized");
}

function waitForReport(): {
  promise: Promise<LoopMonitorReport>;
  onReport: (report: LoopMonitorReport) => void;
} {
  let onReport: (report: LoopMonitorReport) => void = missingReportResolver;
  const promise = new Promise<LoopMonitorReport>((resolve) => {
    onReport = resolve;
  });
  return { promise, onReport };
}

beforeEach(() => {
  mockObserve = vi.fn<(options?: PerformanceObserverInit) => void>();
  mockDisconnect = vi.fn<() => void>();

  const mockInstance: PerformanceObserver = {
    observe: mockObserve,
    disconnect: mockDisconnect,
    takeRecords: () => [],
  };

  vi.stubGlobal(
    "PerformanceObserver",
    vi.fn().mockImplementation(function (cb: PerformanceObserverCallback) {
      capturedCallback = (list) => {
        cb(list, mockInstance);
      };
      return mockInstance;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LoopMonitor", () => {
  it("emits reports with lag, raf, longTasks, and worstWindow fields", async () => {
    const { promise, onReport } = waitForReport();
    const onLongTask = vi.fn();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      sampleDurationMs: 1,
      onReport,
      onLongTask,
    });

    monitor.start();
    dispatchEntries([makeEntry(75)]);

    const report = await promise;
    monitor.stop();

    expect(report.lag.sampleCount).toBeGreaterThanOrEqual(0);
    expect(report.raf.frameCount).toBeGreaterThanOrEqual(0);
    expect(report.longTasks).toHaveProperty("count");
    expect(report.longTasks).toHaveProperty("entries");
    expect(report.worstWindow).toHaveProperty("startMs");
    expect(report.worstWindow).toHaveProperty("blockedTimeMs");
    expect(monitor.snapshot()).toBe(report);
  });

  it("calls onJank when p99 exceeds lagThresholdMs", async () => {
    const { promise, onReport } = waitForReport();
    const onJank = vi.fn();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      sampleDurationMs: 1,
      lagThresholdMs: 0.001,
      onReport,
      onJank,
    });

    monitor.start();
    const report = await promise;
    monitor.stop();

    expect(report.isJanky).toBe(true);
    expect(onJank).toHaveBeenCalledWith(report);
  });

  it("does not start duplicate cycles when start() is called twice", () => {
    const monitor = new LoopMonitor({ sampleDurationMs: 1 });
    monitor.start();
    monitor.start();
    monitor.stop();
    // One PO created by measureLoopLag, not two
    expect(mockObserve).toHaveBeenCalledTimes(1);
  });

  it("does not call onReport after stop()", async () => {
    const onReport = vi.fn();
    const monitor = new LoopMonitor({
      sampleDurationMs: 100,
      onReport,
    });

    monitor.start();
    monitor.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onReport).not.toHaveBeenCalled();
    expect(monitor.snapshot()).toBeNull();
  });

  it("clear() removes the last report", async () => {
    const { promise, onReport } = waitForReport();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      sampleDurationMs: 1,
      onReport,
    });

    monitor.start();
    await promise;
    monitor.clear();
    monitor.stop();

    expect(monitor.snapshot()).toBeNull();
  });

  it.each([
    ["intervalMs", { intervalMs: 0 }],
    ["sampleDurationMs", { sampleDurationMs: -1 }],
    ["lagThresholdMs", { lagThresholdMs: Number.POSITIVE_INFINITY }],
  ])("throws RangeError for invalid %s", (_, options) => {
    expect(() => new LoopMonitor(options)).toThrow(RangeError);
  });
});
