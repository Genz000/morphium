import type { EasingFn } from "./morph-easing";
import type { SequenceMode } from "./morph-types";

/** Keyframe order for one loop. Both modes start and end on frame 1, so the loop seam matches. */
export function keyOrder(frameCount: number, mode: SequenceMode): number[] {
  if (frameCount < 2) return [0];
  const forward = Array.from({ length: frameCount }, (_, i) => i);
  return mode === "pingpong" ? [...forward, ...forward.slice(0, -1).reverse()] : [...forward, 0];
}

export type MorphPhase = { a: number; b: number; p: number; raw: number; holding: boolean };

/**
 * Maps loop progress (0..1, from the Toolcraft timeline) to the two frames being
 * blended. Each step holds on its keyframe for `holdPercent` of the step, then
 * eases to the next keyframe.
 */
export function phaseAt(progress: number, frameCount: number, mode: SequenceMode, holdPercent: number, ease: EasingFn): MorphPhase {
  const order = keyOrder(frameCount, mode);
  if (order.length < 2) return { a: 0, b: 0, p: 0, raw: 0, holding: true };
  const steps = order.length - 1;
  const x = Math.min(Math.max(progress, 0), 1) * steps;
  const i = Math.min(Math.floor(x), steps - 1);
  const local = x - i;
  const hold = Math.min(Math.max(holdPercent, 0), 95) / 100;
  if (local < hold) return { a: order[i], b: order[i + 1], p: 0, raw: 0, holding: true };
  const raw = (local - hold) / (1 - hold);
  return { a: order[i], b: order[i + 1], p: ease(raw), raw, holding: false };
}
