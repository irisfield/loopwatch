import { describe, expect, it } from "vitest";

import { type RafReport, rafCadence } from "../src/raf-cadence";

describe("rafCadence", () => {
  it("resolves with a report containing all required fields", async () => {
    const report = await rafCadence(200);
    const keys: (keyof RafReport)[] = [
      "durationMs",
      "frameCount",
      "estimatedFps",
      "meanFrameTimeMs",
      "p95FrameTimeMs",
      "p99FrameTimeMs",
      "droppedFrames",
    ];
    for (const key of keys) {
      expect(report).toHaveProperty(key);
    }
  });

  it("frameCount is at least 1", async () => {
    const report = await rafCadence(200);
    expect(report.frameCount).toBeGreaterThanOrEqual(1);
  });

  it("estimatedFps is greater than 0", async () => {
    const report = await rafCadence(200);
    expect(report.estimatedFps).toBeGreaterThan(0);
  });

  it("accepts an options object with durationMs", async () => {
    const report = await rafCadence({ durationMs: 200 });
    expect(report.frameCount).toBeGreaterThanOrEqual(1);
  });

  it("resolves immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const report = await rafCadence({ durationMs: 2000, signal: controller.signal });

    expect(report.frameCount).toBe(0);
    expect(report.estimatedFps).toBe(0);
  });

  it("resolves early when aborted before the next frame", async () => {
    const controller = new AbortController();
    const promise = rafCadence({ durationMs: 2000, signal: controller.signal });

    controller.abort();

    const report = await promise;
    expect(report.durationMs).toBeLessThan(2000);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for invalid durationMs %s",
    (durationMs) => {
      expect(() => rafCadence(durationMs)).toThrow(RangeError);
      expect(() => rafCadence({ durationMs })).toThrow(RangeError);
    },
  );
});
