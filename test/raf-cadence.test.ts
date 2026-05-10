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
});
