import type { LagReport } from "./measure-lag";

export interface LagReportDelta {
  durationMsDelta: number;
  sampleCountDelta: number;
  minDelta: number;
  maxDelta: number;
  meanDelta: number;
  p50Delta: number;
  p95Delta: number;
  p99Delta: number;
  blockedTimeMsDelta: number;
  spikeCountDelta: number;
}

export function compareReports(before: LagReport, after: LagReport): LagReportDelta {
  return {
    durationMsDelta: after.durationMs - before.durationMs,
    sampleCountDelta: after.sampleCount - before.sampleCount,
    minDelta: after.min - before.min,
    maxDelta: after.max - before.max,
    meanDelta: after.mean - before.mean,
    p50Delta: after.p50 - before.p50,
    p95Delta: after.p95 - before.p95,
    p99Delta: after.p99 - before.p99,
    blockedTimeMsDelta: after.blockedTimeMs - before.blockedTimeMs,
    spikeCountDelta: after.spikeCount - before.spikeCount,
  };
}
