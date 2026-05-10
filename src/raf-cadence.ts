import { EnvironmentNotSupportedError, hasPerformanceNow, hasRequestAnimationFrame } from "./env";
import { mean, percentile } from "./stats";

export interface RafReport {
  durationMs: number;
  frameCount: number;
  estimatedFps: number;
  meanFrameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  droppedFrames: number;
}

export function rafCadence(durationMs = 2000): Promise<RafReport> {
  if (!hasRequestAnimationFrame()) {
    throw new EnvironmentNotSupportedError("requestAnimationFrame");
  }
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }

  return new Promise<RafReport>((resolve) => {
    const intervals: number[] = [];
    let started = false;
    let startedAt = 0;
    let lastFrameAt = 0;

    function finalize(): void {
      const medianInterval = percentile(intervals, 50);
      resolve({
        durationMs: performance.now() - startedAt,
        frameCount: intervals.length,
        estimatedFps: intervals.length > 0 ? 1000 / mean(intervals) : 0,
        meanFrameTimeMs: mean(intervals),
        p95FrameTimeMs: percentile(intervals, 95),
        p99FrameTimeMs: percentile(intervals, 99),
        droppedFrames: intervals.filter((t) => t > 1.5 * medianInterval).length,
      });
    }

    function frame(now: number): void {
      if (!started) {
        started = true;
        startedAt = now;
        lastFrameAt = now;
        requestAnimationFrame(frame);
        return;
      }

      intervals.push(now - lastFrameAt);
      lastFrameAt = now;

      if (now - startedAt < durationMs) {
        requestAnimationFrame(frame);
      } else {
        finalize();
      }
    }

    requestAnimationFrame(frame);
  });
}
