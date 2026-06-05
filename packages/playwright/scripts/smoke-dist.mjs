import { loopwatchFixture, assertHealthy } from "../dist/index.mjs";

const checks = [
  ["loopwatchFixture", typeof loopwatchFixture === "object" && loopwatchFixture !== null],
  ["assertHealthy", typeof assertHealthy === "function"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "pass" : "FAIL"} ${label}`);
  if (!ok) failed++;
}

if (failed > 0) process.exit(1);
