import { STROKE_DURATION_SEC, DEFAULT_STROKE_STEP_DELAY_SEC } from "@/components/Board";

export function calculateAnimationDuration(
  changed: Array<{ i: number; from: number; to: number }>,
  placedPos: number
): number {
  if (changed.length === 0) return 0;

  const placedChange = changed.find(c => c.i === placedPos);
  if (!placedChange) return 0;

  const placedValue = placedChange.to;
  const placedStepDelaySec = placedValue === 2 ? STROKE_DURATION_SEC : DEFAULT_STROKE_STEP_DELAY_SEC;
  const placedAnimationEndSec = placedValue > 0
    ? (Math.min(placedValue, 5) - 1) * placedStepDelaySec + STROKE_DURATION_SEC
    : 0;

  let maxEndTime = placedAnimationEndSec;

  for (const change of changed) {
    if (change.i === placedPos) continue;
    
    const value = change.to;
    const animateFrom = Math.max(0, value - 1);
    const strokeCount = Math.min(value, 5) - animateFrom;
    const endTime = placedAnimationEndSec + (strokeCount - 1) * DEFAULT_STROKE_STEP_DELAY_SEC + STROKE_DURATION_SEC;
    
    maxEndTime = Math.max(maxEndTime, endTime);
  }

  return maxEndTime * 1000;
}
