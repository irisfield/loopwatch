import { EnvironmentNotSupportedError, hasPerformanceNow, hasRequestAnimationFrame } from "./env";
import { mean, percentile } from "./stats";
import { assertPositiveFinite } from "./validation";

export interface RafReport {
  durationMs: number;
  frameCount: number;
  estimatedFps: number;
  meanFrameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  droppedFrames: number;
}

export interface RafOptions {
  durationMs?: number;
  signal?: AbortSignal;
}

export function rafCadence(options?: number | RafOptions): Promise<RafReport> {
  if (!hasRequestAnimationFrame()) {
    throw new EnvironmentNotSupportedError("requestAnimationFrame");
  }
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }

  const durationMs = typeof options === "number" ? options : (options?.durationMs ?? 2000);
  assertPositiveFinite(durationMs, "durationMs");

  const signal = typeof options === "number" ? undefined : options?.signal;

  return new Promise<RafReport>((resolve) => {
    const intervals: number[] = [];
    let started = false;
    let startedAt = performance.now();
    let lastFrameAt = 0;
    let finalized = false;

    function finalize(): void {
      if (finalized) return;
      finalized = true;
      signal?.removeEventListener("abort", finalize);
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

    if (signal?.aborted) {
      finalize();
      return;
    }

    signal?.addEventListener("abort", finalize);

    function frame(now: number): void {
      if (finalized) return;

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
