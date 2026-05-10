export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = values.toSorted((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerVal = sorted[lower] ?? Number.NaN;
  const upperVal = sorted[upper] ?? Number.NaN;
  return lowerVal + (index - lower) * (upperVal - lowerVal);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function min(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let result = Number.POSITIVE_INFINITY;
  for (const v of values) {
    if (v < result) result = v;
  }
  return result;
}

export function max(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let result = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v > result) result = v;
  }
  return result;
}
