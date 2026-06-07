import { formatCulprit } from "./attribution";

import type { LoopMeasurement } from "./measure-lag";

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

  const culprit = formatCulprit(worstWindow.longTasks);
  if (culprit !== null) {
    result += ` (${culprit})`;
  }

  return result;
}
