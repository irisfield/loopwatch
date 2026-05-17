import { EnvironmentNotSupportedError, hasPerformanceNow, hasRequestAnimationFrame } from "./env";
import { LongTaskObserver, type LongTaskOptions } from "./long-tasks";
import { type LagReport, measureLoopLag } from "./measure-lag";
import { type RafReport, rafCadence } from "./raf-cadence";
import { assertNonNegativeFinite, assertPositiveFinite } from "./validation";

export interface LoopMonitorReport {
  startedAt: number;
  endedAt: number;
  lag: LagReport;
  raf: RafReport;
  longTasks: readonly PerformanceEntry[];
  isJanky: boolean;
}

export interface LoopMonitorOptions {
  intervalMs?: number;
  lagDurationMs?: number;
  rafDurationMs?: number;
  longTaskThreshold?: number;
  lagThresholdMs?: number;
  droppedFrameThreshold?: number;
  onReport?: (report: LoopMonitorReport) => void;
  onLongTask?: (entry: PerformanceEntry) => void;
  onJank?: (report: LoopMonitorReport) => void;
}

export class LoopMonitor {
  private readonly _intervalMs: number;
  private readonly _lagDurationMs: number;
  private readonly _rafDurationMs: number;
  private readonly _lagThresholdMs: number;
  private readonly _droppedFrameThreshold: number;
  private readonly _longTaskObserver: LongTaskObserver;
  private readonly _onReport: ((report: LoopMonitorReport) => void) | undefined;
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
    this._lagDurationMs = options?.lagDurationMs ?? 500;
    this._rafDurationMs = options?.rafDurationMs ?? 500;
    this._lagThresholdMs = options?.lagThresholdMs ?? 50;
    this._droppedFrameThreshold = options?.droppedFrameThreshold ?? 0;

    assertPositiveFinite(this._intervalMs, "intervalMs");
    assertPositiveFinite(this._lagDurationMs, "lagDurationMs");
    assertPositiveFinite(this._rafDurationMs, "rafDurationMs");
    assertPositiveFinite(this._lagThresholdMs, "lagThresholdMs");
    assertNonNegativeFinite(this._droppedFrameThreshold, "droppedFrameThreshold");

    this._onReport = options?.onReport;
    this._onJank = options?.onJank;
    const longTaskOptions: LongTaskOptions = {};
    if (options?.longTaskThreshold !== undefined) {
      longTaskOptions.threshold = options.longTaskThreshold;
    }
    if (options?.onLongTask !== undefined) {
      longTaskOptions.onLongTask = options.onLongTask;
    }
    this._longTaskObserver = new LongTaskObserver(longTaskOptions);
  }

  start(): void {
    if (this._running) return;

    this._running = true;
    this._longTaskObserver.start();
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
    this._longTaskObserver.stop();
  }

  snapshot(): LoopMonitorReport | null {
    return this._lastReport;
  }

  clear(): void {
    this._lastReport = null;
    this._longTaskObserver.clear();
  }

  private async _runCycle(): Promise<void> {
    if (!this._running) return;

    const controller = new AbortController();
    this._controller = controller;
    const startedAt = performance.now();
    const longTaskStartIndex = this._longTaskObserver.getLongTasks().length;

    const lag = await measureLoopLag({
      durationMs: this._lagDurationMs,
      signal: controller.signal,
    });
    if (!this._isActive(controller)) return;

    const raf = await rafCadence({
      durationMs: this._rafDurationMs,
      signal: controller.signal,
    });
    if (!this._isActive(controller)) return;

    const longTasks = this._longTaskObserver.getLongTasks().slice(longTaskStartIndex);
    const report: LoopMonitorReport = {
      startedAt,
      endedAt: performance.now(),
      lag,
      raf,
      longTasks,
      isJanky: lag.p99 >= this._lagThresholdMs || raf.droppedFrames > this._droppedFrameThreshold,
    };

    this._lastReport = report;
    this._onReport?.(report);
    if (report.isJanky) {
      this._onJank?.(report);
    }

    if (this._isActive(controller)) {
      this._timer = setTimeout(() => {
        this._timer = null;
        void this._runCycle();
      }, this._intervalMs);
    }
  }

  private _isActive(controller: AbortController): boolean {
    return this._running && this._controller === controller && !controller.signal.aborted;
  }
}
