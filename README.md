# loopwatch

A tiny TypeScript library that measures JavaScript event-loop responsiveness in the browser.

## Why

Every frontend bottleneck traces back to event-loop contention. Tools like `web-vitals` measure user-facing symptoms (LCP, INP, CLS) but not the underlying mechanic. `loopwatch` measures the mechanic directly. How long does `setTimeout(0)` actually wait? When do microtasks flush relative to macrotasks? What is the real RAF cadence on this display? Are long tasks blocking the main thread?

## Install

```
npm install loopwatch
```

## Usage

### `measureLoopLag`

Fires `setTimeout(0)` repeatedly for the given duration and records how long each callback was delayed from when it was scheduled. A healthy, idle event loop delivers callbacks in 1-4 ms. If your code is doing expensive synchronous work (parsing, layout, large array operations), those delays accumulate and show up as spikes in the lag distribution.

```typescript
import { measureLoopLag } from "loopwatch";

// Sample the event loop for 2 seconds
const report = await measureLoopLag({ durationMs: 2000 });

// report.sampleCount  — number of setTimeout(0) round-trips recorded (typically 1000+)
// report.p50          — median lag in ms; below 2ms is healthy
// report.p99          — worst-case lag for 99% of samples; above 50ms means the thread is blocked
// report.max          — single worst spike observed during the sample window
```

`durationMs` must be a positive finite number. Invalid values throw `RangeError`.

Call it before and after a user action to see how much that action blocks the main thread.

```typescript
const before = await measureLoopLag({ durationMs: 500 });
runExpensiveOperation();
const after = await measureLoopLag({ durationMs: 500 });

if (after.p99 > before.p99 * 3) {
  console.warn("runExpensiveOperation is blocking the event loop");
}
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

### `microtaskScheduling`

Schedules microtasks (`queueMicrotask`) and macrotasks (`setTimeout(0)`) interleaved, then measures when each fires. The result tells you how fast each scheduling mechanism resolves and whether microtasks correctly drain before macrotasks, which the spec requires.

```typescript
import { microtaskScheduling } from "loopwatch";

const report = await microtaskScheduling({ count: 100 });

// report.microtaskMeanLagMs    — how long queueMicrotask callbacks wait; typically < 0.1 ms
// report.macrotaskMeanLagMs    — how long setTimeout(0) callbacks wait; typically 0.5-4 ms
// report.microtasksFlushedFirst — true in any spec-compliant runtime (all microtasks
//                                 drain before the first macrotask runs)

// If macrotaskMeanLagMs is above ~4 ms, the task queue is backed up.
// If microtasksFlushedFirst is false, something is wrong with the runtime.
```

`count` must be a positive integer. Invalid values throw `RangeError`. Pass an `AbortSignal` as `signal` to resolve early.

---

### `rafCadence`

Measures actual frame delivery over a time window using `requestAnimationFrame`. `estimatedFps` alone does not tell you whether frames are arriving evenly or in bursts. The full report does.

```typescript
import { rafCadence } from "loopwatch";

const report = await rafCadence(2000);

// report.estimatedFps      — computed from mean frame time; does not assume 60 Hz
// report.meanFrameTimeMs   — average ms per frame (16.67 ms = 60 fps, 11.11 ms = 90 fps)
// report.p95FrameTimeMs    — 95th-percentile frame time; a proxy for "typical worst frame"
// report.droppedFrames     — frames that took more than 1.5× the median frame time
//
// Healthy animation: droppedFrames === 0, p95 close to meanFrameTimeMs.
// Janky animation:   droppedFrames > 0 or p95 >> meanFrameTimeMs.
```

Pass `{ durationMs, signal }` instead of a number when you need cancellation. `durationMs` must be a positive finite number; invalid values throw `RangeError`.

If `droppedFrames` is non-zero while nothing appears to be running, a background task is stealing render time.

---

### `LoopMonitor`

Runs loop lag, RAF cadence, and long-task collection on a repeating cycle. Use it when you want ongoing app-level telemetry instead of a one-off probe.

```typescript
import { LoopMonitor } from "loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 5000,
  lagDurationMs: 500,
  rafDurationMs: 500,
  lagThresholdMs: 50,
  droppedFrameThreshold: 0,
  onReport: (report) => {
    console.log(report.lag.p99, report.raf.droppedFrames, report.longTasks.length);
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

`start()` and `stop()` are idempotent. `stop()` aborts the active sampling cycle and prevents later callbacks from firing. `clear()` removes the last report and clears buffered long tasks.

---

## Recipes

### Debug a slow click

Wrap the suspect handler with before/after lag samples to isolate which operation is blocking the thread:

```typescript
import { compareReports, measureLoopLag } from "loopwatch";

button.addEventListener("click", async () => {
  const before = await measureLoopLag({ durationMs: 200 });
  processCartItems(cart);
  const after = await measureLoopLag({ durationMs: 200 });

  const delta = compareReports(before, after);
  if (delta.p99Delta > 30 || delta.blockedTimeMsDelta > 0) {
    console.warn("processCartItems is blocking the event loop", delta);
  }
});
```

### Compare before/after an optimization

```typescript
import { compareReports, measureLoopLag } from "loopwatch";

const before = await measureLoopLag({ durationMs: 500 });
runExpensiveOperation();
const after = await measureLoopLag({ durationMs: 500 });

const delta = compareReports(before, after);
console.log(`p99 changed by ${delta.p99Delta.toFixed(1)} ms`);
console.log(`blocked time changed by ${delta.blockedTimeMsDelta.toFixed(1)} ms`);
console.log(`spike count changed by ${delta.spikeCountDelta}`);
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
      longTaskCount: report.longTasks.length,
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

Browsers throttle `requestAnimationFrame` to ~1 fps (or pause it entirely) when a tab is hidden. `rafCadence` can detect this before kicking off rendering work:

```typescript
import { rafCadence } from "loopwatch";

async function isTabThrottled(): Promise<boolean> {
  const { estimatedFps } = await rafCadence({ durationMs: 300 });
  return estimatedFps < 5;
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

| API                     | Required by           | Notes                                                       |
| ----------------------- | --------------------- | ----------------------------------------------------------- |
| `performance.now`       | All exports           | Universal in modern browsers                                |
| `setTimeout`            | `measureLoopLag`      | Universal                                                   |
| `requestAnimationFrame` | `rafCadence`, `LoopMonitor` | Universal                                                   |
| `PerformanceObserver`   | `LongTaskObserver`, `LoopMonitor` | Chrome, Edge, Firefox; `'longtask'` not supported in Safari |
| `queueMicrotask`        | `microtaskScheduling` | All modern browsers                                         |

When a required API is missing, the relevant export throws `EnvironmentNotSupportedError`.

### Safari

Safari does not implement the `longtask` `PerformanceObserver` entry type (as of Safari 17). This affects:

- `LongTaskObserver` — throws `EnvironmentNotSupportedError` on construction in Safari.
- `LoopMonitor` — also throws `EnvironmentNotSupportedError` because it depends on `LongTaskObserver` internally.

`measureLoopLag`, `rafCadence`, and `microtaskScheduling` work in all modern browsers including Safari.

To support Safari alongside Chrome/Edge/Firefox, guard long-task features with a try/catch:

```typescript
import { EnvironmentNotSupportedError, LongTaskObserver } from "loopwatch";

try {
  const observer = new LongTaskObserver({ onLongTask: (entry) => report(entry) });
  observer.start();
} catch (err) {
  if (!(err instanceof EnvironmentNotSupportedError)) throw err;
  // long-task detection not available in this browser
}
```

## Tree-shaking

`"sideEffects": false` is set in `package.json`. Each export is fully independent — importing `measureLoopLag` does not load `LongTaskObserver` or any other module.

## Bundle size

`dist/index.min.mjs`: 3.1 KB minified · 1.3 KB gzipped

## Development

```
git clone https://github.com/irisfield/loopwatch.git
cd loopwatch
bun install
bun test
bun run build
```

### Running the examples

Build first, then serve the project root over HTTP (browsers block ES module imports from `file://`):

```
bun run build
bunx serve .
```

Open `http://localhost:3000/examples/index.html`. Each panel runs independently — select a scenario, click Run, and results appear inline. The page covers all six APIs with scenario controls that create different event-loop conditions: idle baseline, CPU block, repeated blocks, animation pressure, and before/after comparison.

## License

MIT
