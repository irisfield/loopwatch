import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnvironmentNotSupportedError } from "../src/env";
import { LongTaskObserver } from "../src/long-tasks";

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

describe("LongTaskObserver", () => {
  it("throws EnvironmentNotSupportedError when PerformanceObserver is unavailable", () => {
    vi.stubGlobal("PerformanceObserver", null);
    expect(() => new LongTaskObserver()).toThrow(EnvironmentNotSupportedError);
  });

  it("start() calls observe with longtask type and buffered: true", () => {
    const observer = new LongTaskObserver();
    observer.start();
    expect(mockObserve).toHaveBeenCalledWith({ type: "longtask", buffered: true });
  });

  it("stores entries at or above the threshold", () => {
    const observer = new LongTaskObserver({ threshold: 50 });
    observer.start();
    dispatchEntries([makeEntry(49), makeEntry(50), makeEntry(100)]);
    expect(observer.getLongTasks()).toHaveLength(2);
  });

  it("does not store entries below the threshold", () => {
    const observer = new LongTaskObserver({ threshold: 50 });
    observer.start();
    dispatchEntries([makeEntry(49)]);
    expect(observer.getLongTasks()).toHaveLength(0);
  });

  it("calls onLongTask for each entry that meets the threshold", () => {
    const onLongTask = vi.fn();
    const observer = new LongTaskObserver({ threshold: 50, onLongTask });
    observer.start();
    dispatchEntries([makeEntry(49), makeEntry(75), makeEntry(200)]);
    expect(onLongTask).toHaveBeenCalledTimes(2);
  });

  it("yields stored entries via for-of iteration", () => {
    const observer = new LongTaskObserver({ threshold: 50 });
    observer.start();
    dispatchEntries([makeEntry(75), makeEntry(200)]);
    const collected = [...observer];
    expect(collected).toHaveLength(2);
  });

  it("clear() empties the internal entry list", () => {
    const observer = new LongTaskObserver({ threshold: 50 });
    observer.start();
    dispatchEntries([makeEntry(75)]);
    observer.clear();
    expect(observer.getLongTasks()).toHaveLength(0);
  });

  it("stop() is idempotent — safe before start and after stop", () => {
    const observer = new LongTaskObserver();
    expect(() => {
      observer.stop();
    }).not.toThrow();
    observer.start();
    observer.stop();
    expect(() => {
      observer.stop();
    }).not.toThrow();
  });

  it("throws EnvironmentNotSupportedError and disconnects when observe() throws", () => {
    mockObserve.mockImplementation(() => {
      throw new Error("not supported");
    });
    const observer = new LongTaskObserver();
    expect(() => {
      observer.start();
    }).toThrow(EnvironmentNotSupportedError);
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
