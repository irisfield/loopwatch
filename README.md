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
  threshold: 50,                                              // W3C minimum; raise to filter noise
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

If `droppedFrames` is non-zero while nothing appears to be running, a background task is stealing render time.

---

## Browser support

| API | Required by | Notes |
|---|---|---|
| `performance.now` | All exports | Universal in modern browsers |
| `setTimeout` | `measureLoopLag` | Universal |
| `requestAnimationFrame` | `rafCadence` | Universal |
| `PerformanceObserver` | `LongTaskObserver` | Chrome, Edge, Firefox; `'longtask'` not supported in Safari |
| `queueMicrotask` | `microtaskScheduling` | All modern browsers |

When a required API is missing, the relevant export throws `EnvironmentNotSupportedError`.

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

## License

MIT
