import type { LagReport, RafBlock } from "@irisfield/loopwatch";
import type {
  SerializedEntry,
  SerializedLongTaskBlock,
  SerializedLoopMeasurement,
  SerializedScriptTiming,
  SerializedWorstWindow,
} from "@irisfield/loopwatch/serialization";

const BLOCK_THRESHOLD_MS = 50;
const WORST_WINDOW_MS = 500;

interface TimedSample {
  at: number;
  lag: number;
}

interface LoafScript {
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
  readonly sourceCharPosition: number;
  readonly invokerType: string;
  readonly startTime: number;
  readonly duration: number;
}

interface LoafEntry extends PerformanceEntry {
  readonly blockingDuration: number;
  readonly scripts: readonly LoafScript[];
}

interface LoopwatchHarness {
  start(): void;
  end(): SerializedLoopMeasurement;
}

declare global {
  var __loopwatch: LoopwatchHarness | undefined;
  interface Window {
    __loopwatch: LoopwatchHarness;
  }
}

let gen = 0;
let started = false;
let fnStartedAt = 0;
const timedSamples: TimedSample[] = [];
const rawSamples: number[] = [];
const rafIntervals: number[] = [];
let rafLastAt = 0;
let rafStarted = false;
const poEntries: PerformanceEntry[] = [];
let po: PerformanceObserver | null = null;
let lagMin = Number.POSITIVE_INFINITY;
let lagMax = Number.NEGATIVE_INFINITY;
let lagSum = 0;
let lagCount = 0;
let blockedTimeMs = 0;
let spikeCount = 0;

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const loVal = sorted[lo] ?? Number.NaN;
  const hiVal = sorted[hi] ?? Number.NaN;
  if (lo === hi) return loVal;
  return loVal * (hi - idx) + hiVal * (idx - lo);
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isLoafEntry(entry: PerformanceEntry): entry is LoafEntry {
  return entry.entryType === "long-animation-frame";
}

function serializeScript(script: LoafScript): SerializedScriptTiming {
  return {
    sourceURL: script.sourceURL,
    sourceFunctionName: script.sourceFunctionName,
    sourceCharPosition: script.sourceCharPosition,
    invokerType: script.invokerType,
    startTime: script.startTime,
    duration: script.duration,
  };
}

function serializeEntry(entry: PerformanceEntry): SerializedEntry {
  const base: SerializedEntry = {
    name: entry.name,
    entryType: entry.entryType,
    startTime: entry.startTime,
    duration: entry.duration,
  };
  if (isLoafEntry(entry)) {
    base.scripts = entry.scripts.map((s) => serializeScript(s));
    base.blockingDuration = entry.blockingDuration;
  }
  return base;
}

function buildLagReport(): LagReport {
  const sorted = rawSamples.toSorted((a, b) => a - b);
  return {
    sampleCount: lagCount,
    min: lagCount > 0 ? lagMin : Number.NaN,
    max: lagCount > 0 ? lagMax : Number.NaN,
    mean: lagCount > 0 ? lagSum / lagCount : Number.NaN,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    blockedTimeMs,
    spikeCount,
  };
}

function buildRafBlock(): RafBlock {
  const sorted = rafIntervals.toSorted((a, b) => a - b);
  const medianInterval = pct(sorted, 50);
  const meanMs = computeMean(rafIntervals);
  return {
    frameCount: rafIntervals.length,
    estimatedFps: rafIntervals.length > 0 ? 1000 / meanMs : 0,
    meanFrameTimeMs: meanMs,
    p95FrameTimeMs: pct(sorted, 95),
    droppedFrames: rafIntervals.filter((t) => t > 1.5 * medianInterval).length,
  };
}

function computeWorstWindow(
  samples: TimedSample[],
  filteredEntries: PerformanceEntry[],
  fnStart: number,
): SerializedWorstWindow {
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

  const windowStart = samples[bestLeft]?.at ?? fnStart;
  const windowEnd = windowStart + WORST_WINDOW_MS;

  return {
    startMs: windowStart - fnStart,
    endMs: windowEnd - fnStart,
    blockedTimeMs: bestBlocked,
    longTasks: filteredEntries
      .filter((e) => e.startTime >= windowStart && e.startTime < windowEnd)
      .map((e) => serializeEntry(e)),
  };
}

function buildMeasurement(): SerializedLoopMeasurement {
  const fnEndedAt = performance.now();
  const filteredEntries = poEntries.filter(
    (e) => e.startTime >= fnStartedAt && e.startTime <= fnEndedAt,
  );
  const longTasks: SerializedLongTaskBlock = {
    count: filteredEntries.length,
    totalDurationMs: filteredEntries.reduce((s, e) => s + e.duration, 0),
    entries: filteredEntries.map((e) => serializeEntry(e)),
  };
  return {
    durationMs: fnEndedAt - fnStartedAt,
    lag: buildLagReport(),
    longTasks,
    raf: buildRafBlock(),
    worstWindow: computeWorstWindow(timedSamples, filteredEntries, fnStartedAt),
  };
}

function reset(): void {
  gen++;
  started = false;
  fnStartedAt = 0;
  timedSamples.length = 0;
  rawSamples.length = 0;
  rafIntervals.length = 0;
  rafLastAt = 0;
  rafStarted = false;
  poEntries.length = 0;
  po = null;
  lagMin = Number.POSITIVE_INFINITY;
  lagMax = Number.NEGATIVE_INFINITY;
  lagSum = 0;
  lagCount = 0;
  blockedTimeMs = 0;
  spikeCount = 0;
}

function start(): void {
  if (started) return;
  started = true;
  fnStartedAt = performance.now();

  const myGen = gen;

  const entryType = (() => {
    if (typeof PerformanceObserver === "undefined") return null;
    const types = PerformanceObserver.supportedEntryTypes;
    if (types.includes("long-animation-frame")) return "long-animation-frame";
    if (types.includes("longtask")) return "longtask";
    return null;
  })();

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

  function tick(): void {
    if (gen !== myGen) return;
    const requestedAt = performance.now();
    setTimeout(() => {
      if (gen !== myGen) return;
      const now = performance.now();
      const lag = now - requestedAt;
      rawSamples.push(lag);
      timedSamples.push({ at: now, lag });
      if (lag < lagMin) lagMin = lag;
      if (lag > lagMax) lagMax = lag;
      lagSum += lag;
      lagCount++;
      if (lag >= BLOCK_THRESHOLD_MS) {
        blockedTimeMs += lag;
        spikeCount++;
      }
      tick();
    }, 0);
  }

  function rafFrame(now: number): void {
    if (gen !== myGen) return;
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
}

function end(): SerializedLoopMeasurement {
  const result = buildMeasurement();
  po?.disconnect();
  reset();
  return result;
}

globalThis.__loopwatch ??= { start, end };
