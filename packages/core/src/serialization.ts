import type { LagReport, LoopMeasurement, RafBlock } from "./measure-lag";

export interface SerializedScriptTiming {
  sourceURL: string;
  sourceFunctionName: string;
  sourceCharPosition: number;
  invokerType: string;
  startTime: number;
  duration: number;
}

export interface SerializedEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  scripts?: SerializedScriptTiming[];
  blockingDuration?: number;
}

export interface SerializedLongTaskBlock {
  count: number;
  totalDurationMs: number;
  entries: SerializedEntry[];
}

export interface SerializedWorstWindow {
  startMs: number;
  endMs: number;
  blockedTimeMs: number;
  longTasks: SerializedEntry[];
}

export interface SerializedLoopMeasurement {
  durationMs: number;
  lag: LagReport;
  longTasks: SerializedLongTaskBlock;
  raf: RafBlock;
  worstWindow: SerializedWorstWindow;
}

function isLoafEntry(entry: PerformanceEntry): entry is PerformanceLongAnimationFrameTiming {
  return entry.entryType === "long-animation-frame";
}

function serializeScript(script: PerformanceScriptTiming): SerializedScriptTiming {
  return {
    sourceURL: script.sourceURL,
    sourceFunctionName: script.sourceFunctionName,
    sourceCharPosition: script.sourceCharPosition,
    invokerType: script.invokerType,
    startTime: script.startTime,
    duration: script.duration,
  };
}

export function serializeEntry(entry: PerformanceEntry): SerializedEntry {
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

export function serializeMeasurement<T>(
  measurement: Omit<LoopMeasurement<T>, "value">,
): SerializedLoopMeasurement {
  return {
    durationMs: measurement.durationMs,
    lag: measurement.lag,
    raf: measurement.raf,
    longTasks: {
      count: measurement.longTasks.count,
      totalDurationMs: measurement.longTasks.totalDurationMs,
      entries: measurement.longTasks.entries.map((e) => serializeEntry(e)),
    },
    worstWindow: {
      startMs: measurement.worstWindow.startMs,
      endMs: measurement.worstWindow.endMs,
      blockedTimeMs: measurement.worstWindow.blockedTimeMs,
      longTasks: measurement.worstWindow.longTasks.map((e) => serializeEntry(e)),
    },
  };
}
