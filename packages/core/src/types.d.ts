interface PerformanceScriptTiming extends PerformanceEntry {
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
  readonly sourceCharPosition: number;
  readonly invokerType: string;
  readonly windowAttribution: string;
  readonly executionStart: DOMHighResTimeStamp;
  readonly pauseDuration: number;
  readonly forcedStyleAndLayoutDuration: number;
}

interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
  readonly renderStart: DOMHighResTimeStamp;
  readonly styleAndLayoutStart: DOMHighResTimeStamp;
  readonly firstUIEventTimestamp: DOMHighResTimeStamp;
  readonly blockingDuration: number;
  readonly scripts: readonly PerformanceScriptTiming[];
}
