import { LoopMonitor, type LoopMonitorReport } from "loopwatch";
import { useState, useEffect } from "react";

export interface UseLoopWatchOptions {
  intervalMs?: number;
  sampleDurationMs?: number;
  lagThresholdMs?: number;
}

export interface UseLoopWatchResult {
  report: LoopMonitorReport | null;
  isJanky: boolean;
}

export function useLoopWatch(options?: UseLoopWatchOptions): UseLoopWatchResult {
  const [result, setResult] = useState<UseLoopWatchResult>({
    report: null,
    isJanky: false,
  });

  const intervalMs = options?.intervalMs;
  const sampleDurationMs = options?.sampleDurationMs;
  const lagThresholdMs = options?.lagThresholdMs;

  useEffect(() => {
    let monitor: LoopMonitor;
    try {
      monitor = new LoopMonitor({
        ...(intervalMs !== undefined && { intervalMs }),
        ...(sampleDurationMs !== undefined && { sampleDurationMs }),
        ...(lagThresholdMs !== undefined && { lagThresholdMs }),
        onReport: (report) => {
          setResult({ report, isJanky: report.isJanky });
        },
      });
    } catch {
      return;
    }

    monitor.start();
    return () => {
      monitor.stop();
    };
  }, [intervalMs, sampleDurationMs, lagThresholdMs]);

  return result;
}
