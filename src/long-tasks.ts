import { EnvironmentNotSupportedError, hasLongTaskSupport, hasPerformanceObserver } from "./env";
import { assertPositiveFinite } from "./validation";

export interface LongTaskOptions {
  threshold?: number;
  onLongTask?: (entry: PerformanceEntry) => void;
}

export class LongTaskObserver implements Iterable<PerformanceEntry> {
  private readonly _threshold: number;
  private readonly _onLongTask: ((entry: PerformanceEntry) => void) | undefined;
  private _entries: PerformanceEntry[] = [];
  private _observer: PerformanceObserver | null = null;

  constructor(options?: LongTaskOptions) {
    if (!hasPerformanceObserver()) {
      throw new EnvironmentNotSupportedError("PerformanceObserver");
    }
    if (!hasLongTaskSupport()) {
      throw new EnvironmentNotSupportedError("PerformanceObserver type 'longtask'");
    }
    this._threshold = options?.threshold ?? 50;
    assertPositiveFinite(this._threshold, "threshold");

    this._onLongTask = options?.onLongTask;
  }

  start(): void {
    this.stop();

    if (!hasLongTaskSupport()) {
      throw new EnvironmentNotSupportedError("PerformanceObserver type 'longtask'");
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= this._threshold) {
          this._entries.push(entry);
          this._onLongTask?.(entry);
        }
      }
    });

    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      throw new EnvironmentNotSupportedError("PerformanceObserver type 'longtask'");
    }

    this._observer = observer;
  }

  stop(): void {
    this._observer?.disconnect();
    this._observer = null;
  }

  getLongTasks(): readonly PerformanceEntry[] {
    return this._entries;
  }

  clear(): void {
    this._entries = [];
  }

  [Symbol.iterator](): Iterator<PerformanceEntry> {
    return this._entries[Symbol.iterator]();
  }
}
