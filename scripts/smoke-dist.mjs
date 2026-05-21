import { compareReports, EnvironmentNotSupportedError, LongTaskObserver, LoopMonitor, measureLoopLag, microtaskScheduling, rafCadence } from "../dist/index.mjs";
import { compareReports as cr } from "../dist/compare-reports.mjs";
import { LongTaskObserver as lt } from "../dist/long-tasks.mjs";
import { LoopMonitor as lm } from "../dist/loop-monitor.mjs";
import { measureLoopLag as ml } from "../dist/measure-lag.mjs";
import { microtaskScheduling as ms } from "../dist/microtasks.mjs";
import { rafCadence as rc } from "../dist/raf-cadence.mjs";

const checks = [
  ["index: measureLoopLag", typeof measureLoopLag === "function"],
  ["index: compareReports", typeof compareReports === "function"],
  ["index: LongTaskObserver", typeof LongTaskObserver === "function"],
  ["index: microtaskScheduling", typeof microtaskScheduling === "function"],
  ["index: rafCadence", typeof rafCadence === "function"],
  ["index: LoopMonitor", typeof LoopMonitor === "function"],
  ["index: EnvironmentNotSupportedError", typeof EnvironmentNotSupportedError === "function"],
  ["measure-lag subpath", typeof ml === "function"],
  ["compare-reports subpath", typeof cr === "function"],
  ["long-tasks subpath", typeof lt === "function"],
  ["microtasks subpath", typeof ms === "function"],
  ["raf-cadence subpath", typeof rc === "function"],
  ["loop-monitor subpath", typeof lm === "function"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "pass" : "FAIL"} ${label}`);
  if (!ok) failed++;
}

if (failed > 0) process.exit(1);
