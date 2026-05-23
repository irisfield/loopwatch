import type { LoopMeasurement } from "./measure-lag";

export interface LoopMeasurementDelta {
  durationMsDelta: number;
  lag: {
    sampleCountDelta: number;
    minDelta: number;
    maxDelta: number;
    meanDelta: number;
    p50Delta: number;
    p95Delta: number;
    p99Delta: number;
    blockedTimeMsDelta: number;
    spikeCountDelta: number;
  };
  longTasks: {
    countDelta: number;
    totalDurationMsDelta: number;
  };
  raf: {
    frameCountDelta: number;
    estimatedFpsDelta: number;
    meanFrameTimeMsDelta: number;
    p95FrameTimeMsDelta: number;
    droppedFramesDelta: number;
  };
}

export function compareReports<T>(
  before: LoopMeasurement<T>,
  after: LoopMeasurement<T>,
): LoopMeasurementDelta {
  return {
    durationMsDelta: after.durationMs - before.durationMs,
    lag: {
      sampleCountDelta: after.lag.sampleCount - before.lag.sampleCount,
      minDelta: after.lag.min - before.lag.min,
      maxDelta: after.lag.max - before.lag.max,
      meanDelta: after.lag.mean - before.lag.mean,
      p50Delta: after.lag.p50 - before.lag.p50,
      p95Delta: after.lag.p95 - before.lag.p95,
      p99Delta: after.lag.p99 - before.lag.p99,
      blockedTimeMsDelta: after.lag.blockedTimeMs - before.lag.blockedTimeMs,
      spikeCountDelta: after.lag.spikeCount - before.lag.spikeCount,
    },
    longTasks: {
      countDelta: after.longTasks.count - before.longTasks.count,
      totalDurationMsDelta: after.longTasks.totalDurationMs - before.longTasks.totalDurationMs,
    },
    raf: {
      frameCountDelta: after.raf.frameCount - before.raf.frameCount,
      estimatedFpsDelta: after.raf.estimatedFps - before.raf.estimatedFps,
      meanFrameTimeMsDelta: after.raf.meanFrameTimeMs - before.raf.meanFrameTimeMs,
      p95FrameTimeMsDelta: after.raf.p95FrameTimeMs - before.raf.p95FrameTimeMs,
      droppedFramesDelta: after.raf.droppedFrames - before.raf.droppedFrames,
    },
  };
}
