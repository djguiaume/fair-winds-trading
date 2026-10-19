/** Keep brief tacks quiet; only sustained, intentional sailing into the wind needs help. */
export function windFeedback(
  seconds: number,
  dt: number,
  state: { inNoGo: boolean; sailsRaised: boolean; docked: boolean; active: boolean },
) {
  const eligible = state.inNoGo && state.sailsRaised && !state.docked && state.active;
  const elapsed = eligible ? seconds + dt : 0;
  return { seconds: elapsed, amber: eligible, pulse: elapsed >= 1.2, chip: elapsed >= 3 };
}
