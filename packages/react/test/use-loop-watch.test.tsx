import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { LoopMonitorReport } from "@irisfield/loopwatch";

import { useLoopWatch } from "../src/use-loop-watch.js";

interface MockMonitor {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onReport: ((report: LoopMonitorReport) => void) | undefined;
}

const state = vi.hoisted(() => ({ instances: [] as MockMonitor[] }));

vi.mock("@irisfield/loopwatch", () => ({
  LoopMonitor: vi.fn().mockImplementation(function (
    this: object,
    opts?: { onReport?: (r: LoopMonitorReport) => void },
  ) {
    const m: MockMonitor = { start: vi.fn(), stop: vi.fn(), onReport: opts?.onReport };
    state.instances.push(m);
    return m;
  }),
}));

function makeReport(isJanky = false): LoopMonitorReport {
  return {
    durationMs: 0,
    isJanky,
    lag: { sampleCount: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, blockedTimeMs: 0, spikeCount: 0 },
    longTasks: { count: 0, totalDurationMs: 0, entries: [] },
    raf: { frameCount: 0, estimatedFps: 0, meanFrameTimeMs: 0, p95FrameTimeMs: 0, droppedFrames: 0 },
    worstWindow: { startMs: 0, endMs: 0, blockedTimeMs: 0, longTasks: [] },
  };
}

beforeEach(() => {
  // Mutate in place — reassigning state.instances = [] would sever the mock factory's closure
  state.instances.length = 0;
  vi.clearAllMocks();
});

describe("useLoopWatch — lifecycle", () => {
  it("starts the monitor on mount", () => {
    renderHook(() => useLoopWatch());
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]!.start).toHaveBeenCalledOnce();
  });

  it("stops the monitor on unmount", () => {
    const { unmount } = renderHook(() => useLoopWatch());
    unmount();
    expect(state.instances[0]!.stop).toHaveBeenCalledOnce();
  });

  it("does not throw when onReport fires after unmount", () => {
    const { unmount } = renderHook(() => useLoopWatch());
    const monitor = state.instances[0]!;
    expect(monitor.onReport).toBeDefined();
    unmount();
    expect(() => monitor.onReport!(makeReport())).not.toThrow();
  });
});

describe("useLoopWatch — strict mode double-mount", () => {
  it("creates two monitor instances across the double-mount cycle", () => {
    renderHook(() => useLoopWatch(), { wrapper: StrictMode });
    expect(state.instances).toHaveLength(2);
  });

  it("stops the first monitor during strict mode cleanup", () => {
    renderHook(() => useLoopWatch(), { wrapper: StrictMode });
    expect(state.instances[0]!.stop).toHaveBeenCalledOnce();
  });

  it("the second monitor is started and not yet stopped after remount", () => {
    renderHook(() => useLoopWatch(), { wrapper: StrictMode });
    expect(state.instances[1]!.start).toHaveBeenCalledOnce();
    expect(state.instances[1]!.stop).not.toHaveBeenCalled();
  });

  it("report is null until first report fires after remount", () => {
    const { result } = renderHook(() => useLoopWatch(), { wrapper: StrictMode });
    expect(result.current.report).toBeNull();
    expect(result.current.isJanky).toBe(false);
  });
});

describe("useLoopWatch — state updates", () => {
  it("returns initial state { report: null, isJanky: false }", () => {
    const { result } = renderHook(() => useLoopWatch());
    expect(result.current.report).toBeNull();
    expect(result.current.isJanky).toBe(false);
  });

  it("updates report when onReport fires", () => {
    const { result } = renderHook(() => useLoopWatch());
    const report = makeReport();
    act(() => {
      state.instances[0]!.onReport?.(report);
    });
    expect(result.current.report).toBe(report);
  });

  it("reflects isJanky: true from the report", () => {
    const { result } = renderHook(() => useLoopWatch());
    act(() => {
      state.instances[0]!.onReport?.(makeReport(true));
    });
    expect(result.current.isJanky).toBe(true);
  });
});

describe("useLoopWatch — options change", () => {
  it("stops the old monitor and starts a new one when intervalMs changes", () => {
    const { rerender } = renderHook(
      ({ intervalMs }: { intervalMs: number }) => useLoopWatch({ intervalMs }),
      { initialProps: { intervalMs: 5000 } },
    );
    rerender({ intervalMs: 1000 });
    expect(state.instances).toHaveLength(2);
    expect(state.instances[0]!.stop).toHaveBeenCalledOnce();
    expect(state.instances[1]!.start).toHaveBeenCalledOnce();
  });

  it("never has more than one unstopped monitor after repeated option changes", () => {
    const { rerender } = renderHook(
      ({ intervalMs }: { intervalMs: number }) => useLoopWatch({ intervalMs }),
      { initialProps: { intervalMs: 5000 } },
    );
    rerender({ intervalMs: 1000 });
    rerender({ intervalMs: 2000 });
    const activeMonitors = state.instances.filter((m) => m.stop.mock.calls.length === 0);
    expect(activeMonitors).toHaveLength(1);
  });
});

describe("useLoopWatch — constraint verification", () => {
  it("UseLoopWatchOptions does not accept callback fields", () => {
    // These @ts-expect-error directives verify the type constraint at compile time.
    // If UseLoopWatchOptions ever gains a callback field, the unused-directive
    // error from type-check will catch it.
    renderHook(() => {
      // @ts-expect-error — onReport is not a valid option
      return useLoopWatch({ onReport: () => {} });
    });
    renderHook(() => {
      // @ts-expect-error — onJank is not a valid option
      return useLoopWatch({ onJank: () => {} });
    });
    renderHook(() => {
      // @ts-expect-error — onLongTask is not a valid option
      return useLoopWatch({ onLongTask: () => {} });
    });
  });
});
