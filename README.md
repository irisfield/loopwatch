# loopwatch

Event-loop lag measurement and CI enforcement for Playwright and React. Zero runtime deps, ESM-only.

| Package | Description |
|---|---|
| [`loopwatch`](packages/core) | Core measurement engine — `measureLoopLag`, `assertHealthy`, `LoopMonitor` |
| [`loopwatch-playwright`](packages/playwright) | Playwright fixture — fail CI when a user interaction blocks the main thread |
| [`loopwatch-react`](packages/react) | React hooks — ambient loop health state and scoped measurement |

## Install

```
bunx jsr add @irisfield/loopwatch
bunx jsr add @irisfield/loopwatch-playwright
bunx jsr add @irisfield/loopwatch-react
```

## License

MIT
