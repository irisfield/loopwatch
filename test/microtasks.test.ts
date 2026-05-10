import { describe, expect, it } from "vitest";

import { type MicrotaskReport, microtaskScheduling } from "../src/microtasks";

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
});
