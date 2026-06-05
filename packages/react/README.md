# loopwatch-react

React hooks for event-loop measurement. For CI enforcement, use loopwatch-playwright.

[![JSR](https://jsr.io/badges/@irisfield/loopwatch-react)](https://jsr.io/@irisfield/loopwatch-react)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## When to use this package

```
Use loopwatch-react when you want to:
- Display loop health state in a UI (dev overlay, status indicator)
- Measure a specific user action from a click handler

Use loopwatch-playwright instead when you want to:
- Fail a CI test on a blocking interaction (the primary use case)
- Prevent regressions from shipping

Use loopwatch core directly when you want to:
- Continuous telemetry without React state (instantiate LoopMonitor outside React)
- One-off measurements without a component lifecycle
```

## Install

```
bunx jsr add @irisfield/loopwatch-react @irisfield/loopwatch
```

---

## `useLoopWatch`

Runs a `LoopMonitor` for the lifetime of the component and returns the latest health report as React state. Re-renders the component on each new report.

```typescript
import { useLoopWatch } from "loopwatch-react";

function HealthIndicator() {
  const { isJanky, report } = useLoopWatch({ intervalMs: 5000 });

  return (
    <div style={{ color: isJanky ? "red" : "green" }}>
      {report ? `p99: ${report.lag.p99.toFixed(0)}ms` : "measuring..."}
    </div>
  );
}
```

`report` is a `LoopMonitorReport` from the core package. It contains `lag.p50`, `lag.p99`, `lag.blockedTimeMs`, `lag.spikeCount`, `longTasks.count`, `longTasks.totalDurationMs`, and `isJanky`. It is `null` until the first reporting interval completes.

`isJanky` is `report.isJanky` when a report is available, or `false` when no report has arrived yet.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `intervalMs` | `number` | `5000` | How often the monitor emits a report (ms) |
| `sampleDurationMs` | `number` | `1000` | How long each lag sample runs (ms) |
| `lagThresholdMs` | `number` | `50` | Minimum delay to count as a blocking spike (ms) |

All options are optional. Omitting them uses the core `LoopMonitor` defaults.

> `useLoopWatch` does not accept `onReport`, `onJank`, or `onLongTask` callbacks. If you want to send telemetry on each report without updating UI state, instantiate `LoopMonitor` from the `loopwatch` core package directly, outside React. Using a hook for pure side effects forces unnecessary re-renders.

---

## `useLoopMeasure`

Returns a stable `measure` function that wraps any synchronous or async function in a loop-lag measurement. No React state is updated when `measure` is called — you opt in by calling `useState` yourself.

```typescript
import { useLoopMeasure } from "loopwatch-react";
import { summary } from "loopwatch/summary";

function CheckoutButton() {
  const { measure } = useLoopMeasure();

  const handleClick = async () => {
    const m = await measure(() => processCartItems(cart));
    console.log(summary(m));        // local debugging
    telemetry.track("checkout", m); // production telemetry — no re-render
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

`measure` is stable across renders — it is safe to include in `useCallback` or `useEffect` dependency arrays without causing loops.

Calling `measure` does not trigger a re-render. The result is returned as a `Promise<LoopMeasurement<T>>` — what you do with it is up to you.

If `fn()` throws, the error propagates normally. The thrown error has a `.measurement` property attached containing the partial measurement up to the point of failure.

---

## For pure telemetry

If you only want telemetry and don't need React state, this is the right approach. Instantiating `LoopMonitor` directly outside React avoids hook overhead and never causes a re-render:

```typescript
// Outside React — no hook needed, no re-renders
import { LoopMonitor } from "loopwatch";

const monitor = new LoopMonitor({
  intervalMs: 30_000,
  onReport: (report) => analytics.track("loop_health", report),
});

monitor.start(); // call this once at app initialization
```

---

## React Strict Mode

`useLoopWatch` is safe under React Strict Mode's double-mount behavior. When React mounts, unmounts, and remounts the component in development, the monitor is stopped during cleanup and restarted on the second mount. No duplicate measurements occur and no state leaks between the two mount cycles.
