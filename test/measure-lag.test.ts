import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentNotSupportedError } from "../src/env";
import { type LoopMeasurement, measureLoopLag } from "../src/measure-lag";

describe("measureLoopLag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with a LoopMeasurement containing all required fields", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)));
    const lagKeys: (keyof LoopMeasurement<void>["lag"])[] = [
      "sampleCount",
      "min",
      "max",
      "mean",
      "p50",
      "p95",
      "p99",
      "blockedTimeMs",
      "spikeCount",
    ];
    expect(m).toHaveProperty("value");
    expect(m).toHaveProperty("durationMs");
    expect(m).toHaveProperty("lag");
    expect(m).toHaveProperty("longTasks");
    expect(m).toHaveProperty("raf");
    expect(m).toHaveProperty("worstWindow");
    for (const key of lagKeys) expect(m.lag).toHaveProperty(key);
    expect(m.longTasks).toHaveProperty("count");
    expect(m.longTasks).toHaveProperty("totalDurationMs");
    expect(m.longTasks).toHaveProperty("entries");
    expect(m.raf).toHaveProperty("frameCount");
    expect(m.raf).toHaveProperty("meanFrameTimeMs");
    expect(m.raf).toHaveProperty("p95FrameTimeMs");
    expect(m.raf).toHaveProperty("droppedFrames");
    expect(m.worstWindow).toHaveProperty("startMs");
    expect(m.worstWindow).toHaveProperty("endMs");
    expect(m.worstWindow).toHaveProperty("blockedTimeMs");
    expect(m.worstWindow).toHaveProperty("longTasks");
  });

  it("captures the sync return value", async () => {
    const m = await measureLoopLag(() => 42);
    expect(m.value).toBe(42);
  });

  it("captures the async return value", async () => {
    const m = await measureLoopLag(() => Promise.resolve("hello"));
    expect(m.value).toBe("hello");
  });

  it("collects at least one lag sample during a 100ms sleep fn", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)));
    expect(m.lag.sampleCount).toBeGreaterThan(0);
  });

  it("durationMs reflects how long fn ran", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)));
    expect(m.durationMs).toBeGreaterThanOrEqual(90);
  });

  it("resolves immediately for a sync fn and captures basic stats", async () => {
    const m = await measureLoopLag(() => "done");
    expect(m.value).toBe("done");
    expect(m.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("does not include samples field by default", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 50)));
    expect(m.lag).not.toHaveProperty("samples");
  });

  it("includes samples array when samples option is true", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)), {
      samples: true,
    });
    expect(m.lag.samples).toBeDefined();
    expect(m.lag.samples?.length).toBe(m.lag.sampleCount);
  });

  it("rejects with the error from fn, with .measurement attached", async () => {
    const err = new Error("boom");
    let caught: unknown;
    try {
      await measureLoopLag(() => {
        throw err;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(err);
    expect(caught instanceof Error && "measurement" in caught).toBe(true);
  });

  it("attaches measurement to async fn rejection", async () => {
    const err = new Error("async boom");
    let caught: unknown;
    try {
      await measureLoopLag(async () => {
        await new Promise((r) => setTimeout(r, 20));
        throw err;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(err);
    expect(caught instanceof Error && "measurement" in caught).toBe(true);
  });

  it("rejects with abort reason when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      measureLoopLag(() => new Promise((r) => setTimeout(r, 2000)), {
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();
  });

  it("rejects when aborted mid-run", async () => {
    const controller = new AbortController();
    const promise = measureLoopLag(() => new Promise((r) => setTimeout(r, 2000)), {
      signal: controller.signal,
    });
    setTimeout(() => {
      controller.abort();
    }, 50);
    await expect(promise).rejects.toBeDefined();
  });

  it("throws EnvironmentNotSupportedError when performance is unavailable", () => {
    vi.stubGlobal("performance", {});
    expect(() => measureLoopLag(vi.fn())).toThrow(EnvironmentNotSupportedError);
  });

  it("throws EnvironmentNotSupportedError when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", null);
    expect(() => measureLoopLag(vi.fn())).toThrow(EnvironmentNotSupportedError);
  });

  it("worstWindow blockedTimeMs is non-negative", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)));
    expect(m.worstWindow.blockedTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("worstWindow startMs is non-negative", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 100)));
    expect(m.worstWindow.startMs).toBeGreaterThanOrEqual(0);
  });

  it("longTasks.entries is an array", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 50)));
    expect(Array.isArray(m.longTasks.entries)).toBe(true);
  });

  it("longTasks.totalDurationMs matches sum of entry durations", async () => {
    const m = await measureLoopLag(() => new Promise((r) => setTimeout(r, 50)));
    const sum = m.longTasks.entries.reduce((acc, e) => acc + e.duration, 0);
    expect(m.longTasks.totalDurationMs).toBeCloseTo(sum, 5);
  });
});
