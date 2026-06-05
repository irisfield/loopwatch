# Which tool for which job

Performance tooling for React apps clusters into three categories: render profiling, production observability, and pre-deploy enforcement. loopwatch is in the third category. These categories address different problems at different points in the development lifecycle, and most production applications benefit from tools in all three.

---

## At a glance

| Tool | Best for | Not designed for |
|---|---|---|
| **React Scan** | Finding React components that re-render unnecessarily | Main-thread blocking outside the React render cycle |
| **React DevTools Profiler** | Understanding React render timing and component trees | Non-React JavaScript, CI enforcement |
| **Sentry Performance** | Production monitoring, trend analysis, alerting after regressions reach users | Pre-deploy enforcement, scoped interaction measurement |
| **Datadog RUM** | Production observability, Core Web Vitals dashboards, enterprise monitoring | Pre-deploy CI gates, developer-facing interaction diagnosis |
| **Playwright tracing** | Full trace capture for debugging specific test scenarios | Structured lag metrics, CI threshold enforcement |
| **loopwatch-playwright** | Measuring and enforcing main-thread responsiveness for specific user interactions in CI | React render profiling, production trend monitoring |
| **loopwatch-react** | Displaying loop health in a UI, measuring specific React user actions | CI enforcement (use loopwatch-playwright instead) |

---

## React Scan

React Scan identifies components that render more than necessary by hooking into React's render lifecycle. It is excellent for reducing render churn — finding props that change on every render, unnecessary context consumers, missing memoization. It does not observe the JavaScript main thread directly, so synchronous blocking work inside click handlers, heavy JSON parsing, or third-party scripts are invisible to it. Use React Scan to optimize your React tree; use loopwatch to find the work that blocks the thread regardless of where it comes from.

## React DevTools Profiler

The React DevTools Profiler records render timing and lets you walk the component tree to see which components committed and how long each render took. It is the right tool when you want to understand the shape of your React tree's performance or identify which component is responsible for a slow render. Like React Scan, it does not measure non-React work — anything that runs outside React's render cycle is not visible in the Profiler.

## Sentry / Datadog

Sentry and Datadog are production observability platforms. They tell you, after a regression reaches users, what the performance looked like — INP trends, Core Web Vitals scores, session replays of slow interactions. They are the right tool for alerting on production degradation, understanding aggregate performance across users, and retrospective debugging. loopwatch is the right tool for catching a regression before it ships. The two are complementary: use loopwatch in CI to enforce thresholds, use Sentry or Datadog in production to monitor the outcome.

## Playwright built-in tracing

Playwright's built-in `page.metrics()` and trace capture provide general browser telemetry and a full timeline of activity during a test. They are excellent for debugging why a specific test is slow — you can see network requests, rendering, and JavaScript execution in a flame chart. They do not produce structured lag metrics you can assert against: there is no `lag.p99`, no `longTasks.count`, no `assertHealthy()`. loopwatch-playwright gives you typed, structured data you can threshold in a single line of test code.

---

## When to use loopwatch alone

- You are instrumenting a specific interaction that you suspect is blocking the thread
- You want a CI gate that fails when an interaction degrades
- You want to compare before/after an optimization with `compareReports`
- You want ambient event-loop health state in a development UI

## When to use multiple tools together

Recommended workflow:

1. **React Scan** — quickly identify components with render churn
2. **React DevTools Profiler** — understand which renders are expensive and why
3. **loopwatch-playwright** — enforce that no interaction blocks the main thread in CI
4. **Sentry or Datadog** — monitor production performance and alert on regressions after deploy
