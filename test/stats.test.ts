import { describe, expect, it } from "vitest";

import { max, mean, min, percentile } from "../src/stats";

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
