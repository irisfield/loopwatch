import { measureLoopLag, type LoopMeasurement } from "@irisfield/loopwatch";

export interface UseLoopMeasureResult {
  measure: <T>(fn: () => T | Promise<T>) => Promise<LoopMeasurement<T>>;
}

function measure<T>(fn: () => T | Promise<T>): Promise<LoopMeasurement<T>> {
  try {
    return measureLoopLag(fn);
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function useLoopMeasure(): UseLoopMeasureResult {
  return { measure };
}
