# loopwatch-playwright

Catch the interaction that blocks the main thread — before it ships.

[![JSR](https://jsr.io/badges/@irisfield/loopwatch-playwright)](https://jsr.io/@irisfield/loopwatch-playwright)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Bundle size](https://img.shields.io/badge/bundle-2.4KB%20min%20%7C%201.0KB%20gzip-green.svg)
![Chromium tested](https://img.shields.io/badge/tested-Chromium%20headless-blue.svg)

```typescript
import { test as base } from "@playwright/test";
import { loopwatchFixture, assertHealthy } from "@irisfield/loopwatch-playwright";

const test = base.extend(loopwatchFixture);

test("checkout submit does not block the main thread", async ({ page, loop }) => {
  await page.goto("https://your-app.com/checkout");

  const m = await loop.measure(page, async () => {
    await page.click("#submit-order");
  });

  // Fails when synchronous work delays the browser from handling input
  assertHealthy(m, {
    maxP99: 30,        // tail lag must stay under 30ms
    maxBlockedMs: 0,   // zero tolerance for blocking spikes
    maxLongTasks: 0,   // no task should hold the thread for ≥ 50ms
  });
});
```

When a regression ships that blocks the main thread, the test fails with a message naming every violation — and the worst blocking window, with the function and file responsible:

```
Loop health assertion failed:
  - lag.p99 142.3ms exceeds limit 30ms
  - longTasks.count 3 exceeds limit 0
  - lag.blockedTimeMs 142.3ms exceeds limit 0ms
  Worst blocking window: 142ms blocked at t=218ms (encryptPayload in checkout.js)
```

Each violation line names the field, the measured value, and the limit. The final line names the work to delete. No digging through traces to find what regressed.

## In CI

loopwatch-playwright is a standard Playwright test. No special runner, no config flags. Add it to your existing workflow:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run interaction tests
  run: npx playwright test
```

When a threshold is exceeded, the test fails with a structured error that CI surfaces as a red check on the PR:

```
FAILED  tests/checkout.spec.ts > checkout submit does not block the main thread

Error: Loop health assertion failed:
  - lag.p99 142.3ms exceeds limit 30ms
  - longTasks.count 3 exceeds limit 0
  - lag.blockedTimeMs 142.3ms exceeds limit 0ms
  Worst blocking window: 142ms blocked at t=218ms (encryptPayload in checkout.js)
```

The regression is caught before merge. No production monitoring required.

## Why this matters: INP and input delay

> **Scope:** loopwatch-playwright measures **input delay** — the main-thread blocking that delays the browser from *starting* an event handler. It does not measure processing time or presentation delay. It is one component of INP, measured precisely, not all of INP estimated.

INP (Interaction to Next Paint) is a Core Web Vital measuring responsiveness to user interactions. Its first component — input delay — is caused when JavaScript holds the main thread and the browser cannot begin executing event handlers.

When you import a large library on click, parse a JSON payload synchronously, or run a tight loop inside an event handler, the main thread is blocked and the browser cannot respond to user input. That blocking is exactly what loopwatch-playwright catches.

## Install

```
bunx jsr add @irisfield/loopwatch-playwright @irisfield/loopwatch
```

## Setup

**Step 1.** Extend Playwright's base test with the loopwatch fixture:

```typescript
import { test as base } from "@playwright/test";
import { loopwatchFixture } from "@irisfield/loopwatch-playwright";

export const test = base.extend(loopwatchFixture);
export { expect } from "@playwright/test";
```

**Step 2.** Use `loop.measure(page, fn)` around any Playwright action:

```typescript
import { test } from "./fixtures";
import { assertHealthy } from "@irisfield/loopwatch-playwright";

test("form submit does not block the thread", async ({ page, loop }) => {
  await page.goto("https://your-app.com/form");

  const m = await loop.measure(page, async () => {
    await page.click("#submit");
  });

  assertHealthy(m, { maxP99: 30, maxLongTasks: 0 });
});
```

`fn` should contain only user interactions — clicks, fills, keyboard events. Do not navigate inside `fn`; measure one action at a time.

## API

### `loop.measure(page, fn)`

```typescript
loop.measure(page: Page, fn: () => Promise<void>): Promise<SerializedLoopMeasurement>
```

Runs `fn` while sampling event-loop health in the browser. Returns a plain serializable measurement object when `fn` resolves. If `fn` throws, the error propagates and no measurement is returned.

| Field | Type | What it measures |
|---|---|---|
| `durationMs` | `number` | Total wall time of the measured action |
| `lag.p50` | `number` | Median `setTimeout(0)` delay (ms) |
| `lag.p99` | `number` | 99th percentile `setTimeout(0)` delay (ms) |
| `lag.blockedTimeMs` | `number` | Total time spent in blocking spikes ≥ 50ms |
| `lag.spikeCount` | `number` | Number of individual blocking spikes |
| `longTasks.count` | `number` | Tasks that held the main thread ≥ 50ms |
| `longTasks.totalDurationMs` | `number` | Cumulative duration of all long tasks |
| `worstWindow` | `object` | The 500ms window with the most blocking |
| `raf.*` | various | Frame timing — advisory only in headless; do not use in CI assertions |

---

### `assertHealthy(measurement, thresholds)`

```typescript
assertHealthy(measurement: SerializedLoopMeasurement, thresholds: HealthThresholds): void
```

Throws if any threshold is exceeded. Collects all violations before throwing — one error lists every failure. All thresholds are optional; passing `{}` is a no-op.

```typescript
import { assertHealthy } from "@irisfield/loopwatch-playwright";

assertHealthy(m, {
  maxP50: 5,        // fail if median lag exceeds 5ms
  maxP99: 30,       // fail if tail lag exceeds 30ms
  maxBlockedMs: 0,  // fail if any blocked time
  maxLongTasks: 0,  // fail if any long tasks
  maxSpikeCount: 0, // fail if any lag spikes
});
```

Threshold check is strict-greater: `actual > threshold` fails, `actual === threshold` passes.

## Thresholds guide

Starting points — adjust to what your page actually achieves today, then tighten over time:

| Threshold | Starting value | When to use |
|---|---|---|
| `maxP99` | `30` | Good baseline for interactive pages |
| `maxBlockedMs` | `0` | Zero tolerance for any blocking spike — checkout, payment, form submit |
| `maxLongTasks` | `0` | Strictest: any 50ms+ task fails |
| `maxLongTasks` | `1` | Allows one long task — e.g., initial hydration on first render |
| `maxSpikeCount` | `0` | Fails if the lag spikes even once |

Do not use `maxDroppedFrames` in CI assertions. RAF-derived values (`raf.estimatedFps`, `raf.droppedFrames`) are unreliable in headless Chromium — the browser renders at a throttled rate that does not reflect real user frame delivery.

**What is reliable in CI:** `lag.p99`, `lag.blockedTimeMs`, and `longTasks.count` are based on `setTimeout(0)` sampling and PerformanceObserver longtask events. These are consistent across Chromium runs. If your blocking interaction reliably spins for 150ms, these metrics will reliably exceed the threshold — no flake.

## How loopwatch-playwright differs from other tools

| Tool | What it catches | When | CI-assertable? | Scope |
|---|---|---|---|---|
| **loopwatch-playwright** | Main-thread blocking on a specific action | Pre-merge, in CI | **Yes** — structured lag metrics, throws on threshold | Input delay (any JS) |
| React Scan | Unnecessary React re-renders | Local dev | No | React renders only |
| Sentry / Datadog | Regressions in production | After users hit it | No — alerting, not gating | Production RUM |
| Playwright tracing | Full browser trace for debugging | Pre-merge, manual | No — trace, not metric | Full trace |

**React Scan** — detects unnecessary React re-renders via the React Profiler API. Does not measure main-thread blocking or non-React JavaScript. Use React Scan to diagnose render churn; use loopwatch-playwright to enforce that clicks and submits don't hold the thread.

**Sentry / Datadog** — production observability. Tells you after a regression reaches users. loopwatch-playwright catches it before deployment, in CI, against a specific action.

**Playwright built-in tracing** — captures a full trace for debugging. Does not produce structured lag metrics you can assert against in CI. Traces answer "what happened"; loopwatch-playwright answers "did this action block the thread."

---

For in-browser use, local debugging, and ambient monitoring without Playwright, see the [loopwatch core package](https://jsr.io/@irisfield/loopwatch).
