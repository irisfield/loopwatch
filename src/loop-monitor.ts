import { EnvironmentNotSupportedError, hasPerformanceNow, hasRequestAnimationFrame } from "./env";
import { measureLoopLag } from "./measure-lag";
import { assertNonNegativeFinite, assertPositiveFinite } from "./validation";

import type {
  LagReport,
  LongTaskBlock,
  LoopMeasurement,
  RafBlock,
  WorstWindow,
} from "./measure-lag";

export interface LoopMonitorOptions {
  intervalMs?: number;
  sampleDurationMs?: number;
  lagThresholdMs?: number;
  droppedFrameThreshold?: number;
  onReport?: (report: LoopMonitorReport) => void;
  onLongTask?: (entry: PerformanceEntry) => void;
  onJank?: (report: LoopMonitorReport) => void;
}

export interface LoopMonitorReport {
  durationMs: number;
  lag: LagReport;
  longTasks: LongTaskBlock;
  raf: RafBlock;
  worstWindow: WorstWindow;
  isJanky: boolean;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const onAbort = (): void => {
      clearTimeout(id);
      resolve();
    };
    const id = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class LoopMonitor {
  private readonly _intervalMs: number;
  private readonly _sampleDurationMs: number;
  private readonly _lagThresholdMs: number;
  private readonly _droppedFrameThreshold: number;
  private readonly _onReport: ((report: LoopMonitorReport) => void) | undefined;
  private readonly _onLongTask: ((entry: PerformanceEntry) => void) | undefined;
  private readonly _onJank: ((report: LoopMonitorReport) => void) | undefined;
  private _running = false;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _controller: AbortController | null = null;
  private _lastReport: LoopMonitorReport | null = null;

  constructor(options?: LoopMonitorOptions) {
    if (!hasPerformanceNow()) {
      throw new EnvironmentNotSupportedError("performance.now");
    }
    if (!hasRequestAnimationFrame()) {
      throw new EnvironmentNotSupportedError("requestAnimationFrame");
    }

    this._intervalMs = options?.intervalMs ?? 5000;
    this._sampleDurationMs = options?.sampleDurationMs ?? 1000;
    this._lagThresholdMs = options?.lagThresholdMs ?? 50;
    this._droppedFrameThreshold = options?.droppedFrameThreshold ?? 0;

    assertPositiveFinite(this._intervalMs, "intervalMs");
    assertPositiveFinite(this._sampleDurationMs, "sampleDurationMs");
    assertPositiveFinite(this._lagThresholdMs, "lagThresholdMs");
    assertNonNegativeFinite(this._droppedFrameThreshold, "droppedFrameThreshold");

    this._onReport = options?.onReport;
    this._onLongTask = options?.onLongTask;
    this._onJank = options?.onJank;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    void this._runCycle();
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._controller?.abort();
    this._controller = null;
  }

  snapshot(): LoopMonitorReport | null {
    return this._lastReport;
  }

  clear(): void {
    this._lastReport = null;
  }

  private async _runCycle(): Promise<void> {
    if (!this._running) return;

    const controller = new AbortController();
    this._controller = controller;

    let measurement: LoopMeasurement<void>;
    try {
      measurement = await measureLoopLag(
        () => abortableSleep(this._sampleDurationMs, controller.signal),
        { signal: controller.signal },
      );
    } catch {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this._running || this._controller !== controller) return;

    if (this._onLongTask) {
      for (const entry of measurement.longTasks.entries) {
        this._onLongTask(entry);
      }
    }

    const report: LoopMonitorReport = {
      durationMs: measurement.durationMs,
      lag: measurement.lag,
      longTasks: measurement.longTasks,
      raf: measurement.raf,
      worstWindow: measurement.worstWindow,
      isJanky:
        measurement.lag.p99 >= this._lagThresholdMs ||
        measurement.raf.droppedFrames > this._droppedFrameThreshold,
    };

    this._lastReport = report;
    this._onReport?.(report);
    if (report.isJanky) this._onJank?.(report);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this._running && this._controller === controller) {
      this._timer = setTimeout(() => {
        this._timer = null;
        void this._runCycle();
      }, this._intervalMs);
    }
  }
}
