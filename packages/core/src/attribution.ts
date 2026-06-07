interface AttributableScript {
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
}

export interface AttributableLongTask {
  // formatCulprit never reads `name` — it exists so this type has a required
  // property in common with PerformanceEntry/SerializedEntry, which TS's weak-type
  // check otherwise demands before allowing either to satisfy a type whose only
  // member (`scripts`) is optional.
  readonly name: string;
  readonly scripts?: readonly AttributableScript[];
}

export function formatCulprit(longTasks: readonly AttributableLongTask[]): string | null {
  const script = longTasks[0]?.scripts?.[0];
  if (!script?.sourceFunctionName || !script.sourceURL) {
    return null;
  }

  const basename = script.sourceURL.split("/").at(-1) ?? script.sourceURL;
  return `${script.sourceFunctionName} in ${basename}`;
}
