import type { LoopMeasurement } from "./measure-lag";

export interface HealthThresholds {
  maxP50?: number;
  maxP99?: number;
  maxBlockedMs?: number;
  maxSpikeCount?: number;
  maxLongTasks?: number;
  maxDroppedFrames?: number;
}

export function assertHealthy<T>(
  measurement: LoopMeasurement<T>,
  thresholds: HealthThresholds,
): void {
  const violations: string[] = [];

  if (thresholds.maxP50 !== undefined && measurement.lag.p50 > thresholds.maxP50) {
    violations.push(
      `  - lag.p50 ${measurement.lag.p50.toFixed(1)}ms exceeds limit ${String(thresholds.maxP50)}ms`,
    );
  }

  if (thresholds.maxP99 !== undefined && measurement.lag.p99 > thresholds.maxP99) {
    violations.push(
      `  - lag.p99 ${measurement.lag.p99.toFixed(1)}ms exceeds limit ${String(thresholds.maxP99)}ms`,
    );
  }

  if (
    thresholds.maxBlockedMs !== undefined &&
    measurement.lag.blockedTimeMs > thresholds.maxBlockedMs
  ) {
    violations.push(
      `  - lag.blockedTimeMs ${measurement.lag.blockedTimeMs.toFixed(1)}ms exceeds limit ${String(thresholds.maxBlockedMs)}ms`,
    );
  }

  if (
    thresholds.maxSpikeCount !== undefined &&
    measurement.lag.spikeCount > thresholds.maxSpikeCount
  ) {
    violations.push(
      `  - lag.spikeCount ${String(measurement.lag.spikeCount)} exceeds limit ${String(thresholds.maxSpikeCount)}`,
    );
  }

  if (
    thresholds.maxLongTasks !== undefined &&
    measurement.longTasks.count > thresholds.maxLongTasks
  ) {
    violations.push(
      `  - longTasks.count ${String(measurement.longTasks.count)} exceeds limit ${String(thresholds.maxLongTasks)}`,
    );
  }

  if (
    thresholds.maxDroppedFrames !== undefined &&
    measurement.raf.droppedFrames > thresholds.maxDroppedFrames
  ) {
    violations.push(
      `  - raf.droppedFrames ${String(measurement.raf.droppedFrames)} exceeds limit ${String(thresholds.maxDroppedFrames)} (advisory: RAF timing is unreliable in headless environments)`,
    );
  }

  if (violations.length > 0) {
    throw new Error(`Loop health assertion failed:\n${violations.join("\n")}`);
  }
}
