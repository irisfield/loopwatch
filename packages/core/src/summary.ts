import type { LoopMeasurement } from "./measure-lag";

interface LoafScript {
  sourceFunctionName?: string;
  sourceURL?: string;
}

interface LoafEntry extends PerformanceEntry {
  readonly scripts?: readonly LoafScript[];
}

function isLoafEntry(entry: PerformanceEntry): entry is LoafEntry {
  return "scripts" in entry;
}

function renderLag(value: number): string {
  return Number.isNaN(value) ? "—" : String(Math.round(value));
}

export function summary(measurement: LoopMeasurement<unknown>): string {
  const { durationMs, lag, longTasks, worstWindow } = measurement;

  const dur = String(Math.round(durationMs));
  const count = String(longTasks.count);
  const blocked = String(Math.round(worstWindow.blockedTimeMs));
  const start = String(Math.round(worstWindow.startMs));

  let result = `${dur}ms total · p50=${renderLag(lag.p50)}ms p99=${renderLag(lag.p99)}ms · ${count} long task(s) · worst: ${blocked}ms blocked at t=${start}ms`;

  const firstEntry = worstWindow.longTasks[0];
  if (firstEntry !== undefined && isLoafEntry(firstEntry)) {
    const script = firstEntry.scripts?.[0];
    if (script?.sourceFunctionName && script.sourceURL) {
      const basename = script.sourceURL.split("/").at(-1) ?? script.sourceURL;
      result += ` (${script.sourceFunctionName} in ${basename})`;
    }
  }

  return result;
}
