import { EnvironmentNotSupportedError, hasPerformanceNow } from "./env";
import { max, mean, min, percentile } from "./stats";
import { assertPositiveFinite } from "./validation";

export interface MeasureOptions {
  durationMs?: number;
  blockThresholdMs?: number;
  samples?: boolean;
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
  blockedTimeMs: number;
  spikeCount: number;
  samples?: number[];
}

export function measureLoopLag(options?: MeasureOptions): Promise<LagReport> {
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }

  const durationMs = options?.durationMs ?? 2000;
  assertPositiveFinite(durationMs, "durationMs");

  const blockThresholdMs = options?.blockThresholdMs ?? 50;
  assertPositiveFinite(blockThresholdMs, "blockThresholdMs");

  const includeSamples = options?.samples ?? false;
  const signal = options?.signal;

  return new Promise<LagReport>((resolve) => {
    const collected: number[] = [];
    const startedAt = performance.now();
    let finalized = false;

    function finalize(): void {
      if (finalized) return;
      finalized = true;
      signal?.removeEventListener("abort", finalize);

      let blockedTimeMs = 0;
      let spikeCount = 0;
      for (const v of collected) {
        if (v >= blockThresholdMs) {
          blockedTimeMs += v;
          spikeCount++;
        }
      }

      const report: LagReport = {
        durationMs: performance.now() - startedAt,
        sampleCount: collected.length,
        min: min(collected),
        max: max(collected),
        mean: mean(collected),
        p50: percentile(collected, 50),
        p95: percentile(collected, 95),
        p99: percentile(collected, 99),
        blockedTimeMs,
        spikeCount,
      };

      if (includeSamples) {
        report.samples = [...collected];
      }

      resolve(report);
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
        collected.push(performance.now() - requestedAt);
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
