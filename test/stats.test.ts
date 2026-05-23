import { describe, expect, it } from "vitest";

import { TDigest, max, mean, min, percentile } from "../src/stats";

const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("percentile", () => {
  it("returns NaN for an empty array", () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it("returns the value itself for a single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it("p=0 returns the minimum", () => {
    expect(percentile(TEN, 0)).toBe(1);
  });

  it("p=100 returns the maximum", () => {
    expect(percentile(TEN, 100)).toBe(10);
  });

  it("p=50 on [1..10] returns 5.5 via linear interpolation", () => {
    expect(percentile(TEN, 50)).toBe(5.5);
  });

  it("p=95 on [1..10] returns 9.55 via linear interpolation", () => {
    expect(percentile(TEN, 95)).toBeCloseTo(9.55, 10);
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("mean", () => {
  it("returns NaN for an empty array", () => {
    expect(mean([])).toBeNaN();
  });

  it("returns the value itself for a single-element array", () => {
    expect(mean([7])).toBe(7);
  });

  it("returns the correct mean for two elements", () => {
    expect(mean([1, 3])).toBe(2);
  });

  it("returns the correct mean for a larger array", () => {
    expect(mean(TEN)).toBe(5.5);
  });
});

describe("min", () => {
  it("returns NaN for an empty array", () => {
    expect(min([])).toBeNaN();
  });

  it("returns the correct minimum", () => {
    expect(min([3, 1, 2])).toBe(1);
  });

  it("handles a 100,000-element array without stack overflow", () => {
    const large = Array.from({ length: 100_000 }, (_, i) => i);
    expect(min(large)).toBe(0);
  });
});

describe("max", () => {
  it("returns NaN for an empty array", () => {
    expect(max([])).toBeNaN();
  });

  it("returns the correct maximum", () => {
    expect(max([3, 1, 2])).toBe(3);
  });

  it("handles a 100,000-element array without stack overflow", () => {
    const large = Array.from({ length: 100_000 }, (_, i) => i);
    expect(max(large)).toBe(99_999);
  });
});

describe("TDigest", () => {
  it("returns NaN for percentile on empty digest", () => {
    const d = new TDigest();
    expect(d.percentile(50)).toBeNaN();
  });

  it("count starts at 0", () => {
    expect(new TDigest().count).toBe(0);
  });

  it("count increments with each add", () => {
    const d = new TDigest();
    d.add(1);
    d.add(2);
    d.add(3);
    expect(d.count).toBe(3);
  });

  it("returns the single value for p50 with one element", () => {
    const d = new TDigest();
    d.add(42);
    expect(d.percentile(50)).toBe(42);
  });

  it("p0 estimates near minimum for a uniform distribution", () => {
    const d = new TDigest();
    for (let i = 1; i <= 100; i++) d.add(i);
    expect(d.percentile(0)).toBeLessThanOrEqual(10);
    expect(d.percentile(100)).toBeGreaterThanOrEqual(91);
  });

  it("estimates p50 within 10% for a uniform 1-1000 distribution", () => {
    const d = new TDigest();
    for (let i = 1; i <= 1000; i++) d.add(i);
    expect(d.percentile(50)).toBeGreaterThan(450);
    expect(d.percentile(50)).toBeLessThan(550);
  });

  it("estimates p99 in the top 5% for a uniform distribution", () => {
    const d = new TDigest();
    for (let i = 1; i <= 1000; i++) d.add(i);
    expect(d.percentile(99)).toBeGreaterThan(950);
    expect(d.percentile(99)).toBeLessThanOrEqual(1000);
  });

  it("handles duplicate values without error", () => {
    const d = new TDigest();
    for (let i = 0; i < 100; i++) d.add(5);
    expect(d.percentile(50)).toBeCloseTo(5, 0);
  });

  it("handles out-of-order insertion", () => {
    const d = new TDigest();
    const vals = [10, 1, 5, 3, 8, 2, 9, 4, 7, 6];
    for (const v of vals) d.add(v);
    expect(d.percentile(50)).toBeGreaterThan(4);
    expect(d.percentile(50)).toBeLessThan(7);
  });

  it("p99.5 falls in the high cluster for a bimodal distribution", () => {
    const d = new TDigest();
    for (let i = 0; i < 990; i++) d.add(1);
    for (let i = 0; i < 10; i++) d.add(1000);
    // p50 is solidly in the low cluster; p99.5 captures the high-value tail
    expect(d.percentile(50)).toBeLessThan(10);
    expect(d.percentile(99.5)).toBeGreaterThan(100);
  });
});
