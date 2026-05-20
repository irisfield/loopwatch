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
      "blockedTimeMs",
      "spikeCount",
    ];
    for (const key of keys) {
      expect(report).toHaveProperty(key);
    }
  });

  it("collects at least one sample over 200ms", async () => {
    const report = await measureLoopLag({ durationMs: 200 });
    expect(report.sampleCount).toBeGreaterThan(0);
  });

  it("resolves early with sampleCount 0 when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const report = await measureLoopLag({ durationMs: 2000, signal: controller.signal });
    expect(report.sampleCount).toBe(0);
  });

  it("resolves early when aborted mid-run", async () => {
    const controller = new AbortController();
    const promise = measureLoopLag({ durationMs: 2000, signal: controller.signal });
    controller.abort();
    const report = await promise;
    expect(report.durationMs).toBeLessThan(2000);
  });

  it("blockedTimeMs sums samples at or above blockThresholdMs", async () => {
    const report = await measureLoopLag({ durationMs: 200, blockThresholdMs: 0.001 });
    expect(report.blockedTimeMs).toBeGreaterThan(0);
    expect(report.spikeCount).toBeGreaterThan(0);
  });

  it("blockedTimeMs and spikeCount are 0 when no samples exceed the threshold", async () => {
    const report = await measureLoopLag({ durationMs: 200, blockThresholdMs: 1_000_000 });
    expect(report.blockedTimeMs).toBe(0);
    expect(report.spikeCount).toBe(0);
  });

  it("blockedTimeMs and spikeCount are 0 on an aborted report with no samples", async () => {
    const controller = new AbortController();
    controller.abort();
    const report = await measureLoopLag({ durationMs: 2000, signal: controller.signal });
    expect(report.blockedTimeMs).toBe(0);
    expect(report.spikeCount).toBe(0);
  });

  it("does not include samples field by default", async () => {
    const report = await measureLoopLag({ durationMs: 200 });
    expect(report).not.toHaveProperty("samples");
  });

  it("includes samples array when samples option is true", async () => {
    const report = await measureLoopLag({ durationMs: 200, samples: true });
    expect(report.samples).toBeDefined();
    expect(report.samples?.length).toBe(report.sampleCount);
  });

  it("throws EnvironmentNotSupportedError when performance is unavailable", () => {
    vi.stubGlobal("performance", {});
    expect(() => measureLoopLag()).toThrow(EnvironmentNotSupportedError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for invalid durationMs %s",
    (durationMs) => {
      expect(() => measureLoopLag({ durationMs })).toThrow(RangeError);
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for invalid blockThresholdMs %s",
    (blockThresholdMs) => {
      expect(() => measureLoopLag({ blockThresholdMs })).toThrow(RangeError);
    },
  );
});
