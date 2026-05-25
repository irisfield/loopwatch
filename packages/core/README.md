# loopwatch

A tiny TypeScript library that measures JavaScript event-loop responsiveness in the browser.

## Why

Every frontend bottleneck traces back to event-loop contention. Tools like `web-vitals` measure user-facing symptoms (LCP, INP, CLS) but not the underlying mechanic. `loopwatch` measures the mechanic directly: you wrap the suspect work and the library reports what happened to the loop while it ran — lag distribution, frame cadence, long tasks, and the worst contiguous window of blockage.

## Install

```
bunx jsr add @irisfield/loopwatch
```

## Usage

### `measureLoopLag`

Wraps any function — sync or async — and measures event-loop health while it runs. Fires `setTimeout(0)` concurrently to sample lag, collects `requestAnimationFrame` intervals, and observes long tasks. Returns a `LoopMeasurement<T>` when `fn` resolves.

```typescript
import { measureLoopLag } from "loopwatch";

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

### `LongTaskObserver`

Wraps the browser's `PerformanceObserver` for the `longtask` entry type. Any synchronous block of work that holds the main thread for 50 ms or more is a long task. During that time the browser cannot render frames, handle input, or run other callbacks.

```typescript
import { LongTaskObserver } from "loopwatch";

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
import { LoopMonitor } from "loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 5000,      // wait between cycles
  sampleDurationMs: 500, // how long to measure each cycle
  lagThresholdMs: 50,
  droppedFrameThreshold: 0,
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
import { compareReports, measureLoopLag } from "loopwatch";

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

## Recipes

### Debug a slow click

Wrap the suspect handler to isolate which operation is blocking the thread:

```typescript
import { compareReports, measureLoopLag } from "loopwatch";

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
import { compareReports, measureLoopLag } from "loopwatch";

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
import { LoopMonitor } from "loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 30_000,
  lagThresholdMs: 50,
  droppedFrameThreshold: 2,
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

`onReport` fires every `intervalMs`. `onJank` fires only when `lag.p99 >= lagThresholdMs` or `raf.droppedFrames > droppedFrameThreshold`, so it stays quiet under normal conditions and surfaces real problems without noise.

### Detect background-tab throttling

Browsers throttle `requestAnimationFrame` to ~1 fps (or pause it entirely) when a tab is hidden. Check `raf.estimatedFps` from a short measurement before kicking off rendering work:

```typescript
import { measureLoopLag } from "loopwatch";

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

| API                     | Required by                       | Notes                                                       |
| ----------------------- | --------------------------------- | ----------------------------------------------------------- |
| `performance.now`       | All exports                       | Universal in modern browsers                                |
| `setTimeout`            | `measureLoopLag`                  | Universal                                                   |
| `requestAnimationFrame` | `measureLoopLag`, `LoopMonitor`   | Universal                                                   |
| `PerformanceObserver`   | `LongTaskObserver`, `measureLoopLag` (long tasks) | Chrome, Edge, Firefox; `'longtask'` not supported in Safari |

When a required API is missing, the relevant export throws `EnvironmentNotSupportedError`.

### Safari

Safari does not implement the `longtask` `PerformanceObserver` entry type (as of Safari 17). This means:

- `LongTaskObserver` — throws `EnvironmentNotSupportedError` on construction in Safari.
- `measureLoopLag` and `LoopMonitor` — still work in Safari; lag sampling and RAF cadence are unaffected. Long-task entries will be empty (`longTasks.count === 0`) because neither `longtask` nor `long-animation-frame` is available.

To use `LongTaskObserver` safely across browsers:

```typescript
import { EnvironmentNotSupportedError, LongTaskObserver } from "loopwatch";

try {
  const observer = new LongTaskObserver({ onLongTask: (entry) => report(entry) });
  observer.start();
} catch (err) {
  if (!(err instanceof EnvironmentNotSupportedError)) throw err;
  // long-task detection not available in this environment
}
```

## Tree-shaking

`"sideEffects": false` is set in `package.json`. Each export is fully independent — importing `measureLoopLag` does not load `LongTaskObserver` or any other module.

## Bundle size

`dist/index.min.mjs`: 7.8 KB minified · 2.9 KB gzipped

## Development

```
git clone https://github.com/irisfield/loopwatch.git
cd loopwatch
bun install
bun test
bun run build
```

## License

MIT
