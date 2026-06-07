import { formatCulprit } from "./attribution";

import type { AttributableLongTask } from "./attribution";
import type { LagReport, RafBlock } from "./measure-lag";

export interface HealthThresholds {
  maxP50?: number;
  maxP99?: number;
  maxBlockedMs?: number;
  maxSpikeCount?: number;
  maxLongTasks?: number;
  maxDroppedFrames?: number;
}

// Structural — both LoopMeasurement<T> and SerializedLoopMeasurement satisfy this
// (a deliberate widening from the original LoopMeasurement<T>-only contract, see
// ARCHITECTURE.md). It hand-mirrors the subset of those shapes assertHealthy reads;
// adding a field that assertHealthy should check requires updating this too.
export interface AssertableMeasurement {
  durationMs: number;
  lag: LagReport;
  raf: RafBlock;
  longTasks: { count: number; totalDurationMs: number };
  worstWindow: {
    startMs: number;
    endMs: number;
    blockedTimeMs: number;
    longTasks: readonly AttributableLongTask[];
  };
}

export function assertHealthy(
  measurement: AssertableMeasurement,
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
    let message = `Loop health assertion failed:\n${violations.join("\n")}`;

    if (measurement.worstWindow.blockedTimeMs > 0) {
      const blocked = String(Math.round(measurement.worstWindow.blockedTimeMs));
      const start = String(Math.round(measurement.worstWindow.startMs));
      const culprit = formatCulprit(measurement.worstWindow.longTasks);
      const suffix = culprit === null ? "" : ` (${culprit})`;
      message += `\n  Worst blocking window: ${blocked}ms blocked at t=${start}ms${suffix}`;
    }

    throw new Error(message);
  }
}
