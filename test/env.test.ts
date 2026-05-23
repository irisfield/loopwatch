import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EnvironmentNotSupportedError,
  hasLongAnimationFrameSupport,
  hasLongTaskSupport,
  hasPerformanceNow,
  hasPerformanceObserver,
  hasRequestAnimationFrame,
} from "../src/env";

class MockPerformanceObserver implements PerformanceObserver {
  static supportedEntryTypes: string[] = [];
  observe = vi.fn<PerformanceObserver["observe"]>();
  disconnect = vi.fn<PerformanceObserver["disconnect"]>();
  takeRecords(): PerformanceEntryList {
    return [];
  }
  // no-op constructor satisfies PerformanceObserver interface shape for tests
}

function stubPOWithTypes(types: string[]): void {
  MockPerformanceObserver.supportedEntryTypes = types;
  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);
}

describe("env guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockPerformanceObserver.supportedEntryTypes = [];
  });

  it("hasPerformanceNow returns true in happy-dom", () => {
    expect(hasPerformanceNow()).toBe(true);
  });

  it("hasPerformanceObserver returns true in happy-dom", () => {
    expect(hasPerformanceObserver()).toBe(true);
  });

  it("hasRequestAnimationFrame returns true in happy-dom", () => {
    expect(hasRequestAnimationFrame()).toBe(true);
  });

  it("hasLongTaskSupport returns false when supportedEntryTypes is present but excludes longtask", () => {
    // happy-dom exposes supportedEntryTypes but it does not include "longtask"
    expect(hasLongTaskSupport()).toBe(false);
  });

  it("hasLongTaskSupport returns false when supportedEntryTypes excludes longtask", () => {
    stubPOWithTypes(["long-animation-frame"]);
    expect(hasLongTaskSupport()).toBe(false);
  });

  it("hasLongTaskSupport returns true when supportedEntryTypes includes longtask", () => {
    stubPOWithTypes(["longtask"]);
    expect(hasLongTaskSupport()).toBe(true);
  });

  it("hasLongAnimationFrameSupport returns false when supportedEntryTypes excludes it", () => {
    expect(hasLongAnimationFrameSupport()).toBe(false);
  });

  it("hasLongAnimationFrameSupport returns true when supportedEntryTypes includes long-animation-frame", () => {
    stubPOWithTypes(["long-animation-frame"]);
    expect(hasLongAnimationFrameSupport()).toBe(true);
  });

  it("hasLongAnimationFrameSupport returns false when supportedEntryTypes excludes it", () => {
    stubPOWithTypes(["longtask"]);
    expect(hasLongAnimationFrameSupport()).toBe(false);
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
