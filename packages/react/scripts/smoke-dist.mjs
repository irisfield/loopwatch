import { useLoopWatch, useLoopMeasure } from "../dist/index.mjs";

const checks = [
  ["useLoopWatch", typeof useLoopWatch === "function"],
  ["useLoopMeasure", typeof useLoopMeasure === "function"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "pass" : "FAIL"} ${label}`);
  if (!ok) failed++;
}

if (failed > 0) process.exit(1);
