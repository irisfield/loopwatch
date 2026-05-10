# loopwatch

A tiny TypeScript library that measures JavaScript event-loop responsiveness in the browser.

## Why

Every frontend bottleneck traces back to event-loop contention. Tools like `web-vitals` measure user-facing symptoms — LCP, INP, CLS — but not the underlying mechanic. `loopwatch` probes the event loop directly: how long does `setTimeout(0)` actually wait, when do microtasks flush relative to macrotasks, what is the real RAF cadence on this display, and are long tasks blocking the main thread?

## Install

```
npm install loopwatch
```

## Usage

```typescript
import { measureLoopLag } from "loopwatch";

const report = await measureLoopLag({ durationMs: 2000 });
// { durationMs: 2000, sampleCount: 1247, min: 0.1, max: 18.4, mean: 0.6, p50: 0.4, p95: 1.2, p99: 4.1 }
```

```typescript
import { LongTaskObserver } from "loopwatch";

const observer = new LongTaskObserver({
  threshold: 50,
  onLongTask: (entry) => console.warn("long task", entry.duration, "ms"),
});
observer.start();
// ... some time later ...
observer.stop();
for (const entry of observer) {
  console.log(entry.startTime, entry.duration);
}
```

```typescript
import { microtaskScheduling } from "loopwatch";

const report = await microtaskScheduling({ count: 100 });
// { count: 100, microtaskMeanLagMs: 0.02, macrotaskMeanLagMs: 0.5, microtasksFlushedFirst: true }
```

```typescript
import { rafCadence } from "loopwatch";

const report = await rafCadence(2000);
// { durationMs: 2000, frameCount: 120, estimatedFps: 60, meanFrameTimeMs: 16.67, ... }
```

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

See Releases.

## Development

```
git clone https://github.com/irisfield/loopwatch.git
cd loopwatch
npm ci
npm test
npm run build
```

## License

MIT
