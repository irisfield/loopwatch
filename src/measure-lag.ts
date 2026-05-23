import {
  EnvironmentNotSupportedError,
  hasLongAnimationFrameSupport,
  hasLongTaskSupport,
  hasPerformanceNow,
  hasPerformanceObserver,
  hasRequestAnimationFrame,
} from "./env";
import { TDigest, mean, percentile } from "./stats";

export interface MeasureOptions {
  signal?: AbortSignal;
  samples?: boolean;
}

export interface LagReport {
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

export interface LongTaskBlock {
  count: number;
  totalDurationMs: number;
  entries: PerformanceEntry[];
}

export interface RafBlock {
  frameCount: number;
  estimatedFps: number;
  meanFrameTimeMs: number;
  p95FrameTimeMs: number;
  droppedFrames: number;
}

export interface WorstWindow {
  startMs: number;
  endMs: number;
  blockedTimeMs: number;
  longTasks: PerformanceEntry[];
}

export interface LoopMeasurement<T> {
  value: T;
  durationMs: number;
  lag: LagReport;
  longTasks: LongTaskBlock;
  raf: RafBlock;
  worstWindow: WorstWindow;
}

const BLOCK_THRESHOLD_MS = 50;
const WORST_WINDOW_MS = 500;

interface TimedSample {
  at: number;
  lag: number;
}

interface LagAccumulator {
  digest: TDigest;
  timedSamples: TimedSample[];
  rawSamples: number[] | undefined;
  min: number;
  max: number;
  sum: number;
  count: number;
  blockedTimeMs: number;
  spikeCount: number;
}

function buildLagReport(acc: LagAccumulator): LagReport {
  const report: LagReport = {
    sampleCount: acc.count,
    min: acc.count > 0 ? acc.min : Number.NaN,
    max: acc.count > 0 ? acc.max : Number.NaN,
    mean: acc.count > 0 ? acc.sum / acc.count : Number.NaN,
    p50: acc.digest.percentile(50),
    p95: acc.digest.percentile(95),
    p99: acc.digest.percentile(99),
    blockedTimeMs: acc.blockedTimeMs,
    spikeCount: acc.spikeCount,
  };
  if (acc.rawSamples !== undefined) report.samples = acc.rawSamples;
  return report;
}

function buildRafBlock(intervals: number[]): RafBlock {
  const medianInterval = percentile(intervals, 50);
  const meanMs = mean(intervals);
  return {
    frameCount: intervals.length,
    estimatedFps: intervals.length > 0 ? 1000 / meanMs : 0,
    meanFrameTimeMs: meanMs,
    p95FrameTimeMs: percentile(intervals, 95),
    droppedFrames: intervals.filter((t) => t > 1.5 * medianInterval).length,
  };
}

function computeWorstWindow(
  samples: TimedSample[],
  taskEntries: PerformanceEntry[],
  fnStartedAt: number,
): WorstWindow {
  if (samples.length === 0) {
    return { startMs: 0, endMs: 0, blockedTimeMs: 0, longTasks: [] };
  }

  let bestLeft = 0;
  let bestBlocked = 0;
  let left = 0;
  let windowBlocked = 0;

  for (const s of samples) {
    if (s.lag >= BLOCK_THRESHOLD_MS) windowBlocked += s.lag;

    let leftSample = samples[left];
    while (leftSample !== undefined && s.at - leftSample.at > WORST_WINDOW_MS) {
      if (leftSample.lag >= BLOCK_THRESHOLD_MS) windowBlocked -= leftSample.lag;
      left++;
      leftSample = samples[left];
    }

    if (windowBlocked > bestBlocked) {
      bestBlocked = windowBlocked;
      bestLeft = left;
    }
  }

  const windowStart = samples[bestLeft]?.at ?? fnStartedAt;
  const windowEnd = windowStart + WORST_WINDOW_MS;

  return {
    startMs: windowStart - fnStartedAt,
    endMs: windowEnd - fnStartedAt,
    blockedTimeMs: bestBlocked,
    longTasks: taskEntries.filter((e) => e.startTime >= windowStart && e.startTime < windowEnd),
  };
}

function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error("Aborted");
}

export function measureLoopLag<T>(
  fn: () => T | Promise<T>,
  opts?: MeasureOptions,
): Promise<LoopMeasurement<T>> {
  if (!hasPerformanceNow()) {
    throw new EnvironmentNotSupportedError("performance.now");
  }
  if (!hasRequestAnimationFrame()) {
    throw new EnvironmentNotSupportedError("requestAnimationFrame");
  }

  const signal = opts?.signal;

  return new Promise<LoopMeasurement<T>>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const fnStartedAt = performance.now();

    const acc: LagAccumulator = {
      digest: new TDigest(),
      timedSamples: [],
      rawSamples: opts?.samples ? [] : undefined,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      sum: 0,
      count: 0,
      blockedTimeMs: 0,
      spikeCount: 0,
    };

    const rafIntervals: number[] = [];
    let rafLastAt = 0;
    let rafStarted = false;

    const poEntries: PerformanceEntry[] = [];
    let po: PerformanceObserver | null = null;
    if (hasPerformanceObserver()) {
      const entryType = hasLongAnimationFrameSupport()
        ? "long-animation-frame"
        : hasLongTaskSupport()
          ? "longtask"
          : null;
      if (entryType !== null) {
        po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) poEntries.push(entry);
        });
        try {
          po.observe({ type: entryType, buffered: true });
        } catch {
          po.disconnect();
          po = null;
        }
      }
    }

    let done = false;

    function buildMeasurementBase(): Omit<LoopMeasurement<T>, "value"> {
      const fnEndedAt = performance.now();
      const taskEntries = poEntries.filter(
        (e) => e.startTime >= fnStartedAt && e.startTime <= fnEndedAt,
      );
      return {
        durationMs: fnEndedAt - fnStartedAt,
        lag: buildLagReport(acc),
        longTasks: {
          count: taskEntries.length,
          totalDurationMs: taskEntries.reduce((sum, e) => sum + e.duration, 0),
          entries: taskEntries,
        },
        raf: buildRafBlock(rafIntervals),
        worstWindow: computeWorstWindow(acc.timedSamples, taskEntries, fnStartedAt),
      };
    }

    function finish(value: T): void {
      if (done) return;
      done = true;
      signal?.removeEventListener("abort", onAbort);
      po?.disconnect();
      resolve({ value, ...buildMeasurementBase() });
    }

    function fail(thrownValue: unknown): void {
      if (done) return;
      done = true;
      signal?.removeEventListener("abort", onAbort);
      po?.disconnect();
      if (thrownValue instanceof Error) {
        Object.defineProperty(thrownValue, "measurement", {
          value: buildMeasurementBase(),
          writable: true,
          configurable: true,
        });
      }
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(thrownValue);
    }

    function onAbort(): void {
      if (done) return;
      done = true;
      po?.disconnect();
      reject(signal === undefined ? new Error("Aborted") : abortReason(signal));
    }

    signal?.addEventListener("abort", onAbort);

    // Lag sampling loop
    function tick(): void {
      if (done) return;
      const requestedAt = performance.now();
      setTimeout(() => {
        if (done) return;
        const now = performance.now();
        const lag = now - requestedAt;
        acc.digest.add(lag);
        acc.timedSamples.push({ at: now, lag });
        acc.rawSamples?.push(lag);
        if (lag < acc.min) acc.min = lag;
        if (lag > acc.max) acc.max = lag;
        acc.sum += lag;
        acc.count++;
        if (lag >= BLOCK_THRESHOLD_MS) {
          acc.blockedTimeMs += lag;
          acc.spikeCount++;
        }
        tick();
      }, 0);
    }

    // RAF loop
    function rafFrame(now: number): void {
      if (done) return;
      if (!rafStarted) {
        rafStarted = true;
        rafLastAt = now;
        requestAnimationFrame(rafFrame);
        return;
      }
      rafIntervals.push(now - rafLastAt);
      rafLastAt = now;
      requestAnimationFrame(rafFrame);
    }

    tick();
    requestAnimationFrame(rafFrame);

    let result: T | Promise<T>;
    try {
      result = fn();
    } catch (error) {
      fail(error);
      return;
    }

    if (result instanceof Promise) {
      result.then(finish, fail);
    } else {
      finish(result);
    }
  });
}
