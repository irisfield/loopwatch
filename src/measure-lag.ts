import { EnvironmentNotSupportedError, hasPerformanceNow } from "./env";
import { max, mean, min, percentile } from "./stats";

export interface MeasureOptions {
  durationMs?: number;
  signal?: AbortSignal;
}

export interface LagReport {
  durationMs: number;
  sampleCount: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export function measureLoopLag(options?: MeasureOptions): Promise<LagReport> {
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }

  const durationMs = options?.durationMs ?? 2000;
  const signal = options?.signal;

  return new Promise<LagReport>((resolve) => {
    const samples: number[] = [];
    const startedAt = performance.now();
    let finalized = false;

    function finalize(): void {
      if (finalized) return;
      finalized = true;
      signal?.removeEventListener("abort", finalize);
      resolve({
        durationMs: performance.now() - startedAt,
        sampleCount: samples.length,
        min: min(samples),
        max: max(samples),
        mean: mean(samples),
        p50: percentile(samples, 50),
        p95: percentile(samples, 95),
        p99: percentile(samples, 99),
      });
    }

    if (signal?.aborted) {
      finalize();
      return;
    }

    signal?.addEventListener("abort", finalize);

    function tick(): void {
      const requestedAt = performance.now();
      setTimeout(() => {
        if (finalized) return;
        samples.push(performance.now() - requestedAt);
        if (performance.now() - startedAt >= durationMs) {
          finalize();
        } else {
          tick();
        }
      }, 0);
    }

    tick();
  });
}
