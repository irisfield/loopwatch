export function hasPerformanceNow(): boolean {
  return typeof performance !== "undefined" && typeof performance.now === "function";
}

export function hasPerformanceObserver(): boolean {
  return typeof PerformanceObserver === "function";
}

export function hasLongTaskSupport(): boolean {
  if (!hasPerformanceObserver()) return false;
  const { supportedEntryTypes } = PerformanceObserver;
  if (Array.isArray(supportedEntryTypes)) {
    return supportedEntryTypes.includes("longtask");
  }
  return true;
}

export function hasLongAnimationFrameSupport(): boolean {
  if (!hasPerformanceObserver()) return false;
  const { supportedEntryTypes } = PerformanceObserver;
  if (Array.isArray(supportedEntryTypes)) {
    return supportedEntryTypes.includes("long-animation-frame");
  }
  return false;
}

export function hasRequestAnimationFrame(): boolean {
  return typeof requestAnimationFrame === "function";
}

export class EnvironmentNotSupportedError extends Error {
  constructor(missing: string) {
    super(`loopwatch requires ${missing}, which is not available in this environment`);
    this.name = "EnvironmentNotSupportedError";
  }
}
