import { describe, expect, it } from "vitest";

import { compareReports } from "../src/compare-reports";

import type { LagReport } from "../src/measure-lag";

function makeReport(overrides: Partial<LagReport> = {}): LagReport {
  return {
    durationMs: 500,
    sampleCount: 100,
    min: 1,
    max: 10,
    mean: 3,
    p50: 2,
    p95: 8,
    p99: 10,
    blockedTimeMs: 0,
    spikeCount: 0,
    ...overrides,
  };
}

describe("compareReports", () => {
  it("returns zero deltas when before and after are identical", () => {
    const report = makeReport();
    const delta = compareReports(report, report);
    expect(delta.p99Delta).toBe(0);
    expect(delta.blockedTimeMsDelta).toBe(0);
    expect(delta.spikeCountDelta).toBe(0);
  });

  it("returns positive deltas when after is worse", () => {
    const before = makeReport({ p99: 10, blockedTimeMs: 0, spikeCount: 0 });
    const after = makeReport({ p99: 80, blockedTimeMs: 150, spikeCount: 3 });
    const delta = compareReports(before, after);
    expect(delta.p99Delta).toBe(70);
    expect(delta.blockedTimeMsDelta).toBe(150);
    expect(delta.spikeCountDelta).toBe(3);
  });

  it("returns negative deltas when after is better", () => {
    const before = makeReport({ p99: 80, blockedTimeMs: 150, spikeCount: 3 });
    const after = makeReport({ p99: 10, blockedTimeMs: 0, spikeCount: 0 });
    const delta = compareReports(before, after);
    expect(delta.p99Delta).toBe(-70);
    expect(delta.blockedTimeMsDelta).toBe(-150);
    expect(delta.spikeCountDelta).toBe(-3);
  });

  it("computes deltas for all fields", () => {
    const before = makeReport();
    const after = makeReport({
      durationMs: 510,
      sampleCount: 105,
      min: 2,
      max: 20,
      mean: 5,
      p50: 4,
      p95: 15,
      p99: 20,
    });
    const delta = compareReports(before, after);
    expect(delta.durationMsDelta).toBe(10);
    expect(delta.sampleCountDelta).toBe(5);
    expect(delta.minDelta).toBe(1);
    expect(delta.maxDelta).toBe(10);
    expect(delta.meanDelta).toBe(2);
    expect(delta.p50Delta).toBe(2);
    expect(delta.p95Delta).toBe(7);
    expect(delta.p99Delta).toBe(10);
  });
});
