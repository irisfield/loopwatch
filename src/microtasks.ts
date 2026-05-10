import { EnvironmentNotSupportedError, hasPerformanceNow, hasQueueMicrotask } from "./env";
import { mean } from "./stats";

export interface MicrotaskOptions {
  count?: number;
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

  return new Promise<MicrotaskReport>((resolve) => {
    const microLags: number[] = [];
    const macroLags: number[] = [];
    let resolutionOrder = 0;
    let lastMicroOrder = -1;
    let firstMacroOrder = -1;
    let completed = 0;
    const total = count * 2;

    function finalize(): void {
      resolve({
        count,
        microtaskMeanLagMs: mean(microLags),
        macrotaskMeanLagMs: mean(macroLags),
        microtasksFlushedFirst: lastMicroOrder < firstMacroOrder,
      });
    }

    for (let i = 0; i < count; i++) {
      const scheduledAt = performance.now();

      queueMicrotask(() => {
        const order = resolutionOrder++;
        lastMicroOrder = Math.max(lastMicroOrder, order);
        microLags.push(performance.now() - scheduledAt);
        completed++;
        if (completed === total) finalize();
      });

      setTimeout(() => {
        const order = resolutionOrder++;
        if (firstMacroOrder === -1) firstMacroOrder = order;
        macroLags.push(performance.now() - scheduledAt);
        completed++;
        if (completed === total) finalize();
      }, 0);
    }
  });
}
