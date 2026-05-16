import { EnvironmentNotSupportedError, hasPerformanceNow, hasQueueMicrotask } from "./env";
import { mean } from "./stats";
import { assertPositiveInteger } from "./validation";

export interface MicrotaskOptions {
  count?: number;
  signal?: AbortSignal;
}

export interface MicrotaskReport {
  count: number;
  microtaskMeanLagMs: number;
  macrotaskMeanLagMs: number;
  microtasksFlushedFirst: boolean;
}

export function microtaskScheduling(options?: MicrotaskOptions): Promise<MicrotaskReport> {
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }
  if (!hasQueueMicrotask()) {
    throw new EnvironmentNotSupportedError("queueMicrotask");
  }

  const count = options?.count ?? 100;
  assertPositiveInteger(count, "count");

  const signal = options?.signal;

  return new Promise<MicrotaskReport>((resolve) => {
    const microLags: number[] = [];
    const macroLags: number[] = [];
    let resolutionOrder = 0;
    let lastMicroOrder = -1;
    let firstMacroOrder = -1;
    let completed = 0;
    const total = count * 2;
    let finalized = false;

    function finalize(): void {
      if (finalized) return;
      finalized = true;
      signal?.removeEventListener("abort", finalize);
      resolve({
        count,
        microtaskMeanLagMs: mean(microLags),
        macrotaskMeanLagMs: mean(macroLags),
        microtasksFlushedFirst: lastMicroOrder < firstMacroOrder,
      });
    }

    if (signal?.aborted) {
      finalize();
      return;
    }

    signal?.addEventListener("abort", finalize);

    for (let i = 0; i < count; i++) {
      const scheduledAt = performance.now();

      queueMicrotask(() => {
        if (finalized) return;
        const order = resolutionOrder++;
        lastMicroOrder = Math.max(lastMicroOrder, order);
        microLags.push(performance.now() - scheduledAt);
        completed++;
        if (completed === total) finalize();
      });

      setTimeout(() => {
        if (finalized) return;
        const order = resolutionOrder++;
        if (firstMacroOrder === -1) firstMacroOrder = order;
        macroLags.push(performance.now() - scheduledAt);
        completed++;
        if (completed === total) finalize();
      }, 0);
    }
  });
}
