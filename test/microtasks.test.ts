import { afterEach, describe, expect, it, vi } from "vitest";

import { type MicrotaskReport, microtaskScheduling } from "../src/microtasks";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("microtaskScheduling", () => {
  it("resolves with a report containing all required fields", async () => {
    const report = await microtaskScheduling({ count: 10 });
    const keys: (keyof MicrotaskReport)[] = [
      "count",
      "microtaskMeanLagMs",
      "macrotaskMeanLagMs",
      "microtasksFlushedFirst",
    ];
    for (const key of keys) {
      expect(report).toHaveProperty(key);
    }
  });

  it("microtasksFlushedFirst is true in a compliant runtime", async () => {
    const report = await microtaskScheduling({ count: 10 });
    expect(report.microtasksFlushedFirst).toBe(true);
  });

  it("microtaskMeanLagMs is less than macrotaskMeanLagMs", async () => {
    const report = await microtaskScheduling({ count: 10 });
    expect(report.microtaskMeanLagMs).toBeLessThan(report.macrotaskMeanLagMs);
  });

  it("resolves immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const report = await microtaskScheduling({ count: 10, signal: controller.signal });

    expect(report.microtaskMeanLagMs).toBeNaN();
    expect(report.macrotaskMeanLagMs).toBeNaN();
  });

  it("resolves early when aborted before scheduled callbacks run", async () => {
    const controller = new AbortController();
    const promise = microtaskScheduling({ count: 10, signal: controller.signal });

    controller.abort();

    const report = await promise;
    expect(report.microtaskMeanLagMs).toBeNaN();
    expect(report.macrotaskMeanLagMs).toBeNaN();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for invalid count %s",
    (count) => {
      expect(() => microtaskScheduling({ count })).toThrow(RangeError);
    },
  );

  it("throws EnvironmentNotSupportedError when queueMicrotask is unavailable", () => {
    vi.stubGlobal("queueMicrotask", null);
    expect(() => microtaskScheduling()).toThrow("queueMicrotask");
  });
});
