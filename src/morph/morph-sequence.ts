import type { EasingFn } from "./morph-easing";
import type { SequenceMode } from "./morph-types";

/** Keyframe order for one loop. Both modes start and end on frame 1, so the loop seam matches. */
export function keyOrder(frameCount: number, mode: SequenceMode): number[] {
  if (frameCount < 2) return [0];
  const forward = Array.from({ length: frameCount }, (_, i) => i);
  return mode === "pingpong" ? [...forward, ...forward.slice(0, -1).reverse()] : [...forward, 0];
}

export type MorphPhase = { a: number; b: number; p: number; raw: number; holding: boolean };

/** Step timing in milliseconds: rest on each frame, morph time, and extra rest on the last frame. */
export type StepTiming = { delay: number; duration: number; lastHold: number };

/** Rest time for each step of the loop; the step that starts on the last frame rests longer. */
export function stepHolds(frameCount: number, mode: SequenceMode, t: StepTiming): number[] {
  const order = keyOrder(frameCount, mode);
  return order.slice(0, -1).map((key) => Math.max(0, t.delay) + (key === frameCount - 1 ? Math.max(0, t.lastHold) : 0));
}

/** One full loop in milliseconds. */
export function loopMs(frameCount: number, mode: SequenceMode, t: StepTiming): number {
  return stepHolds(frameCount, mode, t).reduce((sum, hold) => sum + hold + Math.max(1, t.duration), 0);
}

/**
 * Maps loop progress (0..1, from the Toolcraft timeline) to the two frames being
 * blended. Each step holds on its keyframe for `holdPercent` of the step, then
 * eases to the next keyframe.
 */
export function phaseAt(
  progress: number, frameCount: number, mode: SequenceMode, holdPercent: number, ease: EasingFn, timing?: StepTiming,
): MorphPhase {
  const order = keyOrder(frameCount, mode);
  if (order.length < 2) return { a: 0, b: 0, p: 0, raw: 0, holding: true };
  if (timing) return phaseAtTime(progress, frameCount, mode, ease, timing, order);
  const steps = order.length - 1;
  const x = Math.min(Math.max(progress, 0), 1) * steps;
  const i = Math.min(Math.floor(x), steps - 1);
  const local = x - i;
  const hold = Math.min(Math.max(holdPercent, 0), 95) / 100;
  if (local < hold) return { a: order[i], b: order[i + 1], p: 0, raw: 0, holding: true };
  const raw = (local - hold) / (1 - hold);
  return { a: order[i], b: order[i + 1], p: ease(raw), raw, holding: false };
}

/** Time-based steps: each step rests for its hold, then morphs for `duration`. */
function phaseAtTime(progress: number, frameCount: number, mode: SequenceMode, ease: EasingFn, t: StepTiming, order: number[]): MorphPhase {
  const holds = stepHolds(frameCount, mode, t);
  const duration = Math.max(1, t.duration);
  let time = Math.min(Math.max(progress, 0), 1) * loopMs(frameCount, mode, t);
  for (let i = 0; i < holds.length; i++) {
    const step = holds[i] + duration;
    if (time < step || i === holds.length - 1) {
      if (time < holds[i]) return { a: order[i], b: order[i + 1], p: 0, raw: 0, holding: true };
      const raw = Math.min(1, (time - holds[i]) / duration);
      return { a: order[i], b: order[i + 1], p: ease(raw), raw, holding: false };
    }
    time -= step;
  }
  return { a: order[0], b: order[1], p: 0, raw: 0, holding: true };
}
