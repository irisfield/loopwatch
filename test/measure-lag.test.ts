import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentNotSupportedError } from "../src/env";
import { type LagReport, measureLoopLag } from "../src/measure-lag";

describe("measureLoopLag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with a LagReport containing all required fields", async () => {
    const report = await measureLoopLag({ durationMs: 200 });
    const keys: (keyof LagReport)[] = [
      "durationMs",
      "sampleCount",
      "min",
      "max",
      "mean",
      "p50",
      "p95",
      "p99",
    ];
    for (const key of keys) {
      expect(report).toHaveProperty(key);
    }
  });

  it("collects at least one sample over 200ms", async () => {
    const report = await measureLoopLag({ durationMs: 200 });
    expect(report.sampleCount).toBeGreaterThan(0);
  });

  it("throws EnvironmentNotSupportedError when performance is unavailable", () => {
    vi.stubGlobal("performance", {});
    expect(() => measureLoopLag()).toThrow(EnvironmentNotSupportedError);
  });

  it("resolves immediately with sampleCount 0 when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const report = await measureLoopLag({ durationMs: 2000, signal: controller.signal });
    expect(report.sampleCount).toBe(0);
  });

  it("resolves early when aborted while running", async () => {
    const controller = new AbortController();
    const promise = measureLoopLag({ durationMs: 2000, signal: controller.signal });

    controller.abort();

    const report = await promise;
    expect(report.durationMs).toBeLessThan(2000);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for invalid durationMs %s",
    (durationMs) => {
      expect(() => measureLoopLag({ durationMs })).toThrow(RangeError);
    },
  );
});
