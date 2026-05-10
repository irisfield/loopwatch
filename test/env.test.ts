import { describe, expect, it } from "vitest";

import {
  EnvironmentNotSupportedError,
  hasPerformanceNow,
  hasPerformanceObserver,
  hasQueueMicrotask,
  hasRequestAnimationFrame,
} from "../src/env";

describe("env guards", () => {
  it("hasPerformanceNow returns true in happy-dom", () => {
    expect(hasPerformanceNow()).toBe(true);
  });

  it("hasPerformanceObserver returns true in happy-dom", () => {
    expect(hasPerformanceObserver()).toBe(true);
  });

  it("hasRequestAnimationFrame returns true in happy-dom", () => {
    expect(hasRequestAnimationFrame()).toBe(true);
  });

  it("hasQueueMicrotask returns true in happy-dom", () => {
    expect(hasQueueMicrotask()).toBe(true);
  });
});

describe("EnvironmentNotSupportedError", () => {
  it("has correct name", () => {
    const err = new EnvironmentNotSupportedError("performance.now");
    expect(err.name).toBe("EnvironmentNotSupportedError");
  });

  it("message includes the missing API name", () => {
    const err = new EnvironmentNotSupportedError("performance.now");
    expect(err.message).toContain("performance.now");
  });

  it("is an instance of Error", () => {
    const err = new EnvironmentNotSupportedError("performance.now");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of EnvironmentNotSupportedError", () => {
    const err = new EnvironmentNotSupportedError("performance.now");
    expect(err).toBeInstanceOf(EnvironmentNotSupportedError);
  });
});
