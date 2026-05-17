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

function missingReportResolver(): void {
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
  it("emits reports with lag, raf, and long-task data", async () => {
    const { promise, onReport } = waitForReport();
    const onLongTask = vi.fn();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      lagDurationMs: 1,
      rafDurationMs: 1,
      onReport,
      onLongTask,
    });

    monitor.start();
    dispatchEntries([makeEntry(75)]);

    const report = await promise;
    monitor.stop();

    expect(report.lag.sampleCount).toBeGreaterThan(0);
    expect(report.raf.frameCount).toBeGreaterThanOrEqual(1);
    expect(report.longTasks).toHaveLength(1);
    expect(onLongTask).toHaveBeenCalledTimes(1);
    expect(monitor.snapshot()).toBe(report);
  });

  it("calls onJank when a report crosses the configured threshold", async () => {
    const { promise, onReport } = waitForReport();
    const onJank = vi.fn();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      lagDurationMs: 1,
      rafDurationMs: 1,
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

  it("does not start duplicate observers when start() is called twice", () => {
    const monitor = new LoopMonitor({ lagDurationMs: 1, rafDurationMs: 1 });

    monitor.start();
    monitor.start();
    monitor.stop();

    expect(mockObserve).toHaveBeenCalledTimes(1);
  });

  it("does not call onReport after stop()", async () => {
    const onReport = vi.fn();
    const monitor = new LoopMonitor({
      lagDurationMs: 100,
      rafDurationMs: 100,
      onReport,
    });

    monitor.start();
    monitor.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onReport).not.toHaveBeenCalled();
    expect(monitor.snapshot()).toBeNull();
  });

  it("clear() removes the last report and buffered long tasks", async () => {
    const { promise, onReport } = waitForReport();
    const monitor = new LoopMonitor({
      intervalMs: 1000,
      lagDurationMs: 1,
      rafDurationMs: 1,
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
    ["lagDurationMs", { lagDurationMs: -1 }],
    ["rafDurationMs", { rafDurationMs: Number.NaN }],
    ["lagThresholdMs", { lagThresholdMs: Number.POSITIVE_INFINITY }],
    ["droppedFrameThreshold", { droppedFrameThreshold: -1 }],
  ])("throws RangeError for invalid %s", (_, options) => {
    expect(() => new LoopMonitor(options)).toThrow(RangeError);
  });
});
