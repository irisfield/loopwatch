# loopwatch

loopwatch measures the main-thread blocking that delays user input — and turns regressions into failing CI tests before they ship.

[![JSR](https://jsr.io/badges/@irisfield/loopwatch)](https://jsr.io/@irisfield/loopwatch)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Bundle size](https://img.shields.io/badge/bundle-9.0KB%20min%20%7C%203.3KB%20gzip-green.svg)
![Zero deps](https://img.shields.io/badge/deps-zero-brightgreen.svg)

- Wraps any user interaction and measures how long the main thread was blocked
- Throws a descriptive error in CI when lag, blocked time, or long tasks exceed your thresholds
- Uses `long-animation-frame` (LoAF) when available for source-level attribution, falls back to `longtask`
- Ships as ESM with zero runtime dependencies
- Tree-shakeable — `assertHealthy` and `summary` are separate subpath exports
- First-class Playwright integration for CI — React and DevTools support included

## Install

```
bunx jsr add @irisfield/loopwatch
```

loopwatch runs in the browser. Bundle it into your app with Vite, esbuild, or any other bundler, or inject it into a Playwright test page via `addInitScript`. It does not run in Node.js.

## Quick Start

```typescript
import { measureLoopLag } from "@irisfield/loopwatch";
import { assertHealthy } from "@irisfield/loopwatch/assert";

const m = await measureLoopLag(async () => {
  await processCartItems(cart);
});

assertHealthy(m, { maxP99: 30, maxBlockedMs: 0, maxLongTasks: 0 });
```

loopwatch fires a concurrent `setTimeout(0)` loop while your function runs. When JavaScript holds the main thread synchronously — parsing JSON, running a tight loop, executing a heavy event handler — that timer fires late. The delay is the lag. `await` on network I/O does not register as lag because the thread is idle during the wait.

When `assertHealthy` throws, the error names every violation — and, when LoAF attribution is available, the worst blocking window and the function and file responsible:

```
Loop health assertion failed:
  - lag.p99 142.3ms exceeds limit 30ms
  - longTasks.count 2 exceeds limit 0
  - lag.blockedTimeMs 142.3ms exceeds limit 0ms
  Worst blocking window: 142ms blocked at t=218ms (encryptPayload in checkout.js)
```

That final line is the work to delete, not just a number that crossed a threshold.

Drop it into any test runner and it becomes a failing CI test. When a test fails, call `summary(m)` to get LoAF source attribution pointing to the exact function and file that blocked:

```
523ms total · p50=3ms p99=142ms · 2 long task(s) · worst: 142ms blocked at t=218ms (encryptPayload in checkout.js)
```

The `encryptPayload in checkout.js` line is LoAF attribution — the browser names the script and function that held the thread. No guessing which call site caused the spike.

For the full Playwright CI integration — wrapping real browser interactions in headless Chromium and measuring thread health per click — see [loopwatch-playwright](https://jsr.io/@irisfield/loopwatch-playwright).

## In CI

loopwatch runs in the browser, not in Node. The Playwright fixture handles injection and serialization for you. With `loopwatch-playwright`, your existing Playwright CI step is all you need:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run interaction tests
  run: npx playwright test
```

The test fails with a structured error on threshold violations — a red check on the PR, not a vague timeout:

```
FAILED  tests/checkout.spec.ts > checkout submit does not block the main thread

Error: Loop health assertion failed:
  - lag.p99 142.3ms exceeds limit 30ms
  - longTasks.count 3 exceeds limit 0
  - lag.blockedTimeMs 142.3ms exceeds limit 0ms
  Worst blocking window: 142ms blocked at t=218ms (encryptPayload in checkout.js)
```

## INP and input delay

> **Scope:** loopwatch measures **input delay** — the main-thread blocking that delays the browser from *starting* an event handler. It does not measure processing time or presentation delay. It is one component of INP, measured precisely, not all of INP estimated.

INP (Interaction to Next Paint) is a Core Web Vital that measures responsiveness to user interactions. Its first component — input delay — is caused by main-thread blocking: when JavaScript holds the thread, the browser cannot begin executing event handlers. loopwatch measures exactly this.

## Why not `performance.now()`?

`performance.now()` measures wall time — it cannot distinguish between a 200ms network request (thread idle, no problem) and a 200ms synchronous loop (thread blocked, page frozen). Both look identical in wall time.

loopwatch runs a concurrent `setTimeout(0)` sampler while your function executes. When the main thread is blocked, `setTimeout` fires late — that latency is the lag measurement. A 200ms `await fetch(...)` produces near-zero lag because the thread is genuinely idle during the wait. A 200ms `while (Date.now() < end) {}` produces 200ms of lag because the thread cannot run anything else.

The additional signals — LoAF/longtask entries for attribution, percentile aggregation for statistical robustness, worst-window analysis — are non-trivial to implement correctly and easy to get subtly wrong.

## API

All exports are individually importable and tree-shake independently. The core primitive is `measureLoopLag` — everything else builds on top of it.

### `measureLoopLag`

> **Browser only.** Requires `performance.now`, `requestAnimationFrame`, and optionally `PerformanceObserver`. Does not run in Node.js.

Wraps any function — sync or async — and measures event-loop health while it runs. Fires `setTimeout(0)` concurrently to sample lag, collects `requestAnimationFrame` intervals, and observes long tasks (using `long-animation-frame` when available, falling back to `longtask`). Returns a `LoopMeasurement<T>` when `fn` resolves.

```typescript
import { measureLoopLag } from "@irisfield/loopwatch";

const m = await measureLoopLag(async () => {
  await processCartItems(cart);
});

// m.value              — the return value of fn
// m.durationMs         — total wall time fn ran
// m.lag.p50            — median setTimeout(0) delay; below 2 ms is healthy
// m.lag.p99            — tail lag; above 50 ms means the thread was blocked
// m.lag.blockedTimeMs  — total time spent in spikes >= 50 ms
// m.longTasks.count    — tasks that held the main thread >= 50 ms
// m.raf.estimatedFps   — frame delivery rate while fn ran
// m.raf.droppedFrames  — frames that took more than 1.5× the median
// m.worstWindow        — the 500 ms window with the highest blocked time
```

If `fn` throws, the error is rethrown with a `.measurement` property attached so you can inspect loop state at the moment of failure.

Pass `signal` to cancel mid-run:

```typescript
const controller = new AbortController();
const m = await measureLoopLag(() => longRunningWork(), { signal: controller.signal });
```

---

### `assertHealthy` · `loopwatch/assert`

Throws if any threshold is exceeded. Collects all violations before throwing — one error lists every failure. All thresholds are optional; passing `{}` is a no-op.

```typescript
import { assertHealthy } from "@irisfield/loopwatch/assert";

assertHealthy(m, {
  maxP99: 30, // fail if p99 lag exceeds 30 ms
  maxBlockedMs: 0, // fail if any blocked time
  maxLongTasks: 0, // fail if any long tasks
  maxSpikeCount: 0, // fail if any lag spikes
  maxDroppedFrames: 2, // advisory — unreliable in headless; annotated in error output
});
```

Threshold check is strict-greater: `actual > threshold` fails, `actual === threshold` passes.

---

### `summary` · `loopwatch/summary`

Formats a `LoopMeasurement` as a human-readable one-line string. Useful for `console.log` during local development. Does not throw for any input.

```typescript
import { summary } from "@irisfield/loopwatch/summary";

console.log(summary(m));
// "523ms total · p50=1ms p99=4ms · 0 long task(s) · worst: 0ms blocked at t=0ms"

// With LoAF attribution when available:
// "523ms total · p50=3ms p99=142ms · 2 long task(s) · worst: 142ms blocked at t=218ms (encryptPayload in checkout.js)"
```

---

### `LongTaskObserver`

Observes main-thread blocking work. Uses the `long-animation-frame` (LoAF) entry type when available (Chrome 116+), falling back to `longtask`. LoAF entries include `scripts` attribution — the source file and function name of the script that blocked the thread.

```typescript
import { LongTaskObserver } from "@irisfield/loopwatch";

const observer = new LongTaskObserver({
  threshold: 50, // W3C minimum; raise to filter noise
  onLongTask: (entry) => console.warn("long task", entry.duration, "ms"),
});

observer.start();
// ... your application runs ...
observer.stop();

for (const entry of observer) {
  // entry.startTime  — when the task started (ms from navigation)
  // entry.duration   — how long it ran (ms); directly translates to dropped frames
  console.log(`${entry.duration.toFixed(0)} ms task at t=${entry.startTime.toFixed(0)} ms`);
}
```

`threshold` must be a positive finite number. Invalid values throw `RangeError`.

A single 100 ms long task drops roughly 6 frames at 60 Hz and makes the page feel frozen to the user.

---

### `LoopMonitor`

Runs `measureLoopLag` on a repeating cycle. Use it when you want ongoing app-level telemetry instead of a one-off probe.

```typescript
import { LoopMonitor } from "@irisfield/loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 5000, // wait between cycles
  sampleDurationMs: 500, // how long to measure each cycle
  lagThresholdMs: 50,
  onReport: (report) => {
    console.log(report.lag.p99, report.raf.droppedFrames, report.longTasks.count);
  },
  onJank: (report) => {
    console.warn("event loop jank", report);
  },
});

monitor.start();

// Later:
const latest = monitor.snapshot();
monitor.stop();
```

`start()` and `stop()` are idempotent. `stop()` aborts the active sampling cycle and prevents later callbacks from firing. `clear()` removes the last report.

---

### `compareReports`

Diffs two `LoopMeasurement` objects. Returns a `LoopMeasurementDelta` with nested `lag`, `longTasks`, and `raf` sub-objects.

```typescript
import { compareReports, measureLoopLag } from "@irisfield/loopwatch";

const before = await measureLoopLag(() => sleep(500));
runExpensiveOperation();
const after = await measureLoopLag(() => sleep(500));

const delta = compareReports(before, after);
// delta.lag.p99Delta           — change in tail lag
// delta.lag.blockedTimeMsDelta — change in total blocked time
// delta.lag.spikeCountDelta    — change in threshold crossings
// delta.raf.droppedFramesDelta — change in dropped frames
```

---

## Ecosystem

- **[loopwatch](https://jsr.io/@irisfield/loopwatch)** — this package, measurement engine
- **loopwatch-playwright** — Playwright fixture for CI enforcement (flagship)
- **loopwatch-react** — React hooks for local diagnostics (optional)

For a comparison of loopwatch alongside React Scan, Sentry, Datadog, and Playwright tracing, see [which tool for which job](docs/which-tool.md).

---

## Recipes

### Debug a slow click

Wrap the suspect handler to isolate which operation is blocking the thread:

```typescript
import { compareReports, measureLoopLag } from "@irisfield/loopwatch";

button.addEventListener("click", async () => {
  const before = await measureLoopLag(() => sleep(200));
  processCartItems(cart);
  const after = await measureLoopLag(() => sleep(200));

  const delta = compareReports(before, after);
  if (delta.lag.p99Delta > 30 || delta.lag.blockedTimeMsDelta > 0) {
    console.warn("processCartItems is blocking the event loop", delta);
  }
});
```

### Compare before/after an optimization

```typescript
import { compareReports, measureLoopLag } from "@irisfield/loopwatch";

const before = await measureLoopLag(() => sleep(500));
runExpensiveOperation();
const after = await measureLoopLag(() => sleep(500));

const delta = compareReports(before, after);
console.log(`p99 changed by ${delta.lag.p99Delta.toFixed(1)} ms`);
console.log(`blocked time changed by ${delta.lag.blockedTimeMsDelta.toFixed(1)} ms`);
console.log(`spike count changed by ${delta.lag.spikeCountDelta}`);
```

A negative `p99Delta` means the optimization reduced tail latency. Use `spikeCountDelta` to confirm that the number of threshold crossings also dropped — `p99` alone can mask bursty behavior.

### Send telemetry to an analytics service

Wire `LoopMonitor` to your telemetry pipeline for continuous production monitoring:

```typescript
import { LoopMonitor } from "@irisfield/loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 30_000,
  lagThresholdMs: 50,
  onReport: (report) => {
    analytics.track("loop_health", {
      p99LagMs: report.lag.p99,
      blockedTimeMs: report.lag.blockedTimeMs,
      droppedFrames: report.raf.droppedFrames,
      longTaskCount: report.longTasks.count,
      isJanky: report.isJanky,
    });
  },
  onJank: (report) => {
    errorTracker.captureMessage("event loop jank", { extra: report });
  },
});

monitor.start();
```

`onReport` fires every `intervalMs`. `onJank` fires when `lag.p99 > lagThresholdMs`, so it stays quiet under normal conditions and surfaces real problems without noise.

### Detect background-tab throttling

> **Advisory:** `raf.estimatedFps` is unreliable in headless environments and CI runners. This recipe is for production browser contexts only.

Browsers throttle `requestAnimationFrame` to ~1 fps (or pause it entirely) when a tab is hidden. Check `raf.estimatedFps` from a short measurement before kicking off rendering work:

```typescript
import { measureLoopLag } from "@irisfield/loopwatch";

async function isTabThrottled(): Promise<boolean> {
  const { raf } = await measureLoopLag(() => sleep(300));
  return raf.estimatedFps < 5;
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && (await isTabThrottled())) {
    console.warn("tab was throttled; skipping animation initialization");
    return;
  }
  startAnimation();
});
```

Typical foreground RAF cadence is 60–120 fps depending on the display. A reading below 5 fps reliably indicates the tab is backgrounded or the browser is deprioritizing it.

---

## Privacy

loopwatch measures only event-loop and rendering timing. It does not collect, transmit, or expose any personally identifiable information, user identity, network activity, or fingerprinting data. The numbers it produces (lag percentiles, frame times, long-task durations) describe the runtime environment, not the user.

---

## Browser support

| API                           | Required by                                       | Notes                                          |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `performance.now`             | All exports                                       | Universal in modern browsers                   |
| `setTimeout`                  | `measureLoopLag`                                  | Universal                                      |
| `requestAnimationFrame`       | `measureLoopLag`, `LoopMonitor`                   | Universal                                      |
| `PerformanceObserver`         | `LongTaskObserver`, `measureLoopLag` (long tasks) | Chrome, Edge, Firefox; not supported in Safari |
| `long-animation-frame` (LoAF) | `LongTaskObserver`, `measureLoopLag`              | Chrome 116+; `longtask` used as fallback       |

When a required API is missing, the relevant export throws `EnvironmentNotSupportedError`.

### Safari

Safari does not implement the `longtask` or `long-animation-frame` `PerformanceObserver` entry types (as of Safari 17). This means:

- `LongTaskObserver` — throws `EnvironmentNotSupportedError` on construction in Safari.
- `measureLoopLag` and `LoopMonitor` — still work in Safari; lag sampling and RAF cadence are unaffected. Long-task entries will be empty (`longTasks.count === 0`) because neither `longtask` nor `long-animation-frame` is available.

To use `LongTaskObserver` safely across browsers:

```typescript
import { EnvironmentNotSupportedError, LongTaskObserver } from "@irisfield/loopwatch";

try {
  const observer = new LongTaskObserver({ onLongTask: (entry) => report(entry) });
  observer.start();
} catch (error) {
  if (!(error instanceof EnvironmentNotSupportedError)) throw error;
  // long-task detection not available in this environment
}
```

## Tree-shaking

`"sideEffects": false` is set in `package.json`. Each export is fully independent — importing `measureLoopLag` does not load `LongTaskObserver` or any other module.

## Development

```
git clone https://github.com/irisfield/loopwatch.git
cd loopwatch
bun install
bun run build              # compile all packages
bun run test               # vitest unit tests
bun run lint               # eslint
bunx playwright install chromium
bun run test:browser       # browser smoke tests (requires build first)
```

## License

MIT
