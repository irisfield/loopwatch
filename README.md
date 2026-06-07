# loopwatch

**Catch the user interaction that blocks the main thread — before it ships.**

[![JSR](https://jsr.io/badges/@irisfield/loopwatch-playwright)](https://jsr.io/@irisfield/loopwatch-playwright)
[![JSR](https://jsr.io/badges/@irisfield/loopwatch)](https://jsr.io/@irisfield/loopwatch)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

When a click, tap, or form submit runs synchronous JavaScript that holds the main thread, the browser cannot respond — the interaction feels frozen and your INP regresses. loopwatch measures that blocking work **during a real user action** and turns it into a failing test, so the regression breaks the build instead of reaching users.

Zero runtime dependencies. ESM-only. Built for Playwright CI first.

## The painkiller

A Playwright test that fails when an interaction blocks the main thread:

```typescript
import { test as base } from "@playwright/test";
import { loopwatchFixture, assertHealthy } from "loopwatch-playwright";

const test = base.extend(loopwatchFixture);

test("checkout submit stays responsive", async ({ page, loop }) => {
  await page.goto("https://your-app.com/checkout");

  const m = await loop.measure(page, async () => {
    await page.click("#submit-order");
  });

  assertHealthy(m, {
    maxP99: 30,       // tail input-handling lag must stay under 30ms
    maxBlockedMs: 0,  // no blocking spike >= 50ms
    maxLongTasks: 0,  // no task may hold the thread for >= 50ms
  });
});
```

When the interaction blocks the thread, the build fails with the metric, the measured value, and the limit it broke:

```
Loop health assertion failed:
  - lag.p99 142.3ms exceeds limit 30ms
  - longTasks.count 3 exceeds limit 0
  - lag.blockedTimeMs 142.3ms exceeds limit 0ms
```

## Packages

| Package | What it's for |
|---|---|
| [`loopwatch-playwright`](packages/playwright) | **Start here.** Fail CI when a user interaction blocks the main thread. The flagship. |
| [`loopwatch`](packages/core) | The measurement engine — `measureLoopLag`, `assertHealthy`, `LoopMonitor`. Use directly for in-browser monitoring and one-off measurements. |
| [`loopwatch-react`](packages/react) | React hooks for ambient loop-health state and scoped measurement. A convenience layer, not the enforcement story. |

## What loopwatch measures — and what it doesn't

loopwatch owns **input delay**: the gap between a user interaction and the moment the browser can begin running your event handlers, caused by synchronous JavaScript holding the main thread. This is one of the three components of [INP](https://web.dev/articles/inp).

It does **not** measure event-handler execution time (processing) or rendering (presentation delay), so it does not claim to fix all of INP. It is not a production monitor.

| If you need... | Use |
|---|---|
| To fail a PR when an interaction blocks the main thread | **loopwatch** |
| Post-deploy monitoring and Core Web Vitals dashboards | Sentry / Datadog |
| To find unnecessary React re-renders | React Scan |

## Install

```
bunx jsr add @irisfield/loopwatch-playwright @irisfield/loopwatch
```

See each package's README for full API reference, threshold guidance, and setup.

## License

MIT
