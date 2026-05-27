import { assertHealthy, compareReports, EnvironmentNotSupportedError, LongTaskObserver, LoopMonitor, measureLoopLag } from "../dist/index.mjs";
import { assertHealthy as ah } from "../dist/assert.mjs";
import { compareReports as cr } from "../dist/compare-reports.mjs";
import { LongTaskObserver as lt } from "../dist/long-tasks.mjs";
import { LoopMonitor as lm } from "../dist/loop-monitor.mjs";
import { measureLoopLag as ml } from "../dist/measure-lag.mjs";

const checks = [
  ["index: measureLoopLag", typeof measureLoopLag === "function"],
  ["index: compareReports", typeof compareReports === "function"],
  ["index: LongTaskObserver", typeof LongTaskObserver === "function"],
  ["index: LoopMonitor", typeof LoopMonitor === "function"],
  ["index: EnvironmentNotSupportedError", typeof EnvironmentNotSupportedError === "function"],
  ["index: assertHealthy", typeof assertHealthy === "function"],
  ["assert subpath", typeof ah === "function"],
  ["measure-lag subpath", typeof ml === "function"],
  ["compare-reports subpath", typeof cr === "function"],
  ["long-tasks subpath", typeof lt === "function"],
  ["loop-monitor subpath", typeof lm === "function"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "pass" : "FAIL"} ${label}`);
  if (!ok) failed++;
}

if (failed > 0) process.exit(1);
