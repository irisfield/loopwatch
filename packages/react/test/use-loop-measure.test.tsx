import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { LoopMeasurement } from "loopwatch";

import { useLoopMeasure } from "../src/use-loop-measure.js";

const mockMeasureLoopLag = vi.hoisted(() => vi.fn());

vi.mock("loopwatch", () => ({
  measureLoopLag: mockMeasureLoopLag,
}));

function makeMeasurement<T>(value: T): LoopMeasurement<T> {
  return {
    value,
    durationMs: 0,
    lag: { sampleCount: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, blockedTimeMs: 0, spikeCount: 0 },
    longTasks: { count: 0, totalDurationMs: 0, entries: [] },
    raf: { frameCount: 0, estimatedFps: 0, meanFrameTimeMs: 0, p95FrameTimeMs: 0, droppedFrames: 0 },
    worstWindow: { startMs: 0, endMs: 0, blockedTimeMs: 0, longTasks: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLoopMeasure — stable reference", () => {
  it("measure is the same reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useLoopMeasure());
    const first = result.current.measure;
    rerender();
    rerender();
    expect(Object.is(result.current.measure, first)).toBe(true);
  });
});

describe("useLoopMeasure — stateless contract", () => {
  it("calling measure does not cause a re-render", async () => {
    let renderCount = 0;
    mockMeasureLoopLag.mockResolvedValue(makeMeasurement("x"));

    const { result } = renderHook(() => {
      renderCount++;
      return useLoopMeasure();
    });

    const before = renderCount;
    await result.current.measure(() => "x");
    expect(renderCount).toBe(before);
  });

  it("measure returns a Promise", () => {
    mockMeasureLoopLag.mockResolvedValue(makeMeasurement(undefined));
    const { result } = renderHook(() => useLoopMeasure());
    const ret = result.current.measure(() => undefined);
    expect(ret).toBeInstanceOf(Promise);
  });

  it("measure resolves to the LoopMeasurement returned by measureLoopLag", async () => {
    const expected = makeMeasurement(42);
    mockMeasureLoopLag.mockResolvedValue(expected);
    const { result } = renderHook(() => useLoopMeasure());
    const measurement = await result.current.measure(() => 42);
    expect(measurement).toBe(expected);
  });
});

describe("useLoopMeasure — generic type passthrough", () => {
  beforeEach(() => {
    mockMeasureLoopLag.mockImplementation(async (fn: () => unknown) => {
      const value = await fn();
      return makeMeasurement(value);
    });
  });

  it("resolves with the string value from fn", async () => {
    const { result } = renderHook(() => useLoopMeasure());
    const m = await result.current.measure(() => "hello");
    expect(m.value).toBe("hello");
  });

  it("resolves with the number value from fn", async () => {
    const { result } = renderHook(() => useLoopMeasure());
    const m = await result.current.measure(() => 42);
    expect(m.value).toBe(42);
  });
});

describe("useLoopMeasure — error propagation", () => {
  it("propagates async rejection from measureLoopLag", async () => {
    const error = new Error("async rejection");
    mockMeasureLoopLag.mockRejectedValue(error);
    const { result } = renderHook(() => useLoopMeasure());
    await expect(result.current.measure(() => "x")).rejects.toThrow("async rejection");
  });

  it("converts a synchronous throw from measureLoopLag into a rejected Promise", async () => {
    const error = new Error("sync throw");
    // Simulates EnvironmentNotSupportedError thrown before measureLoopLag returns a Promise
    mockMeasureLoopLag.mockImplementation(() => {
      throw error;
    });
    const { result } = renderHook(() => useLoopMeasure());
    await expect(result.current.measure(() => "x")).rejects.toThrow("sync throw");
    // Reset so the throwing implementation does not leak into subsequent tests —
    // vi.clearAllMocks() only clears call history, not the implementation
    mockMeasureLoopLag.mockReset();
  });

  it("preserves .measurement on the rejected error", async () => {
    const error = new Error("fn failed");
    const measurement = makeMeasurement(undefined);
    Object.defineProperty(error, "measurement", { value: measurement, writable: true, configurable: true });
    mockMeasureLoopLag.mockRejectedValue(error);

    const { result } = renderHook(() => useLoopMeasure());
    let caught: unknown;
    try {
      await result.current.measure(() => "x");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(error);
    expect(caught).toHaveProperty("measurement", measurement);
  });
});
