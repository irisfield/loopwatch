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

/**
 * Online percentile estimator using the t-digest algorithm (Dunning 2019).
 *
 * Buffers incoming values and compresses them into centroids when the buffer
 * is full or on the first percentile query. Uses the k1 scale function:
 *   maxWeight = n * 2π * √(q·(1−q)) / δ
 * This keeps centroids small (high resolution) at the tails and allows
 * larger centroids near the median, bounding total centroid count to ≈ δ.
 */
export class TDigest {
  private readonly _delta: number;
  private readonly _bufferCapacity: number;
  private _centroids: Centroid[] = [];
  private _buffer: number[] = [];
  private _n = 0;

  constructor(delta = 100) {
    this._delta = delta;
    this._bufferCapacity = delta * 5;
  }

  add(x: number): void {
    this._buffer.push(x);
    this._n++;
    if (this._buffer.length >= this._bufferCapacity) {
      this._flush();
    }
  }

  percentile(p: number): number {
    this._flush();
    if (this._centroids.length === 0) return Number.NaN;

    const target = (p / 100) * this._n;
    let cumulative = 0;
    let prevCMean = this._centroids[0]?.mean ?? Number.NaN;

    for (const c of this._centroids) {
      const prevCum = cumulative;
      cumulative += c.weight;

      if (cumulative >= target) {
        if (prevCum === 0) return c.mean;
        const t = c.weight > 0 ? (target - prevCum) / c.weight : 0;
        return prevCMean + t * (c.mean - prevCMean);
      }

      prevCMean = c.mean;
    }

    return this._centroids.at(-1)?.mean ?? Number.NaN;
  }

  get count(): number {
    return this._n;
  }

  private _maxWeight(qMid: number): number {
    // k1 scale function: each centroid spans at most 1 unit of k1-space.
    // dk1/dq = δ/(2π√(q(1−q))), so the max weight per centroid is
    // n / (dk1/dq) = n · 2π√(q(1−q)) / δ.
    return Math.max(1, (this._n * 2 * Math.PI * Math.sqrt(qMid * (1 - qMid))) / this._delta);
  }

  private _flush(): void {
    if (this._buffer.length === 0) return;

    // Merge buffer values as weight-1 centroids with existing centroids, sort by mean.
    const combined: Centroid[] = [
      ...this._centroids,
      ...this._buffer.map((v) => ({ mean: v, weight: 1 })),
    ];
    this._buffer = [];
    combined.sort((a, b) => a.mean - b.mean);

    // Rebuild centroid list. Track cumWeightBefore = total weight of all
    // completed centroids so we can compute each open centroid's q-midpoint.
    this._centroids = [];
    let cumWeightBefore = 0;

    for (const c of combined) {
      const last = this._centroids.at(-1);

      if (last !== undefined) {
        const mergedWeight = last.weight + c.weight;
        const qMid = (cumWeightBefore + mergedWeight / 2) / this._n;
        if (mergedWeight <= this._maxWeight(qMid)) {
          last.mean = (last.mean * last.weight + c.mean * c.weight) / mergedWeight;
          last.weight = mergedWeight;
          continue;
        }
        cumWeightBefore += last.weight;
      }

      this._centroids.push({ mean: c.mean, weight: c.weight });
    }
  }
}

interface Centroid {
  mean: number;
  weight: number;
}
