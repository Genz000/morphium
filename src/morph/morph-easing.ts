import { createCurveEvaluator } from "@/toolcraft/runtime";

export type EasingFn = (t: number) => number;

const bounceOut: EasingFn = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (hi - lo > 1e-6) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

const TAU = 2 * Math.PI;

/** Preset curves carried over from the original tool. `custom` reads the curve control. */
export const EASING_PRESETS = {
  linear: { label: "Linear", fn: cubicBezier(0, 0, 1, 1) },
  ease: { label: "Ease", fn: cubicBezier(0.25, 0.1, 0.25, 1) },
  "ease-in": { label: "Ease in", fn: cubicBezier(0.42, 0, 1, 1) },
  "ease-out": { label: "Ease out", fn: cubicBezier(0, 0, 0.58, 1) },
  "ease-in-out": { label: "Ease in-out", fn: cubicBezier(0.42, 0, 0.58, 1) },
  "sine-in-out": { label: "Sine in-out", fn: cubicBezier(0.37, 0, 0.63, 1) },
  "quad-in-out": { label: "Quad in-out", fn: cubicBezier(0.45, 0, 0.55, 1) },
  "cubic-in-out": { label: "Cubic in-out", fn: cubicBezier(0.65, 0, 0.35, 1) },
  "quart-in-out": { label: "Quart in-out", fn: cubicBezier(0.76, 0, 0.24, 1) },
  "quint-in-out": { label: "Quint in-out", fn: cubicBezier(0.83, 0, 0.17, 1) },
  "expo-in-out": { label: "Expo in-out", fn: cubicBezier(0.87, 0, 0.13, 1) },
  "circ-in-out": { label: "Circ in-out", fn: cubicBezier(0.85, 0, 0.15, 1) },
  "expo-out": { label: "Expo out", fn: cubicBezier(0.16, 1, 0.3, 1) },
  "back-in-out": { label: "Back in-out", fn: cubicBezier(0.68, -0.6, 0.32, 1.6) },
  "back-out": { label: "Back out", fn: cubicBezier(0.34, 1.56, 0.64, 1) },
  "elastic-out": { label: "Elastic out", fn: (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1) },
  "elastic-in-out": {
    label: "Elastic in-out",
    fn: (t: number) => t === 0 || t === 1 ? t : t < 0.5
      ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * (TAU / 4.5))) / 2
      : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * (TAU / 4.5))) / 2 + 1,
  },
  "bounce-out": { label: "Bounce out", fn: bounceOut },
  "bounce-in-out": { label: "Bounce in-out", fn: (t: number) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2) },
  steps: { label: "Steps (4)", fn: (t: number) => (t >= 1 ? 1 : Math.floor(t * 4) / 4) },
} satisfies Record<string, { label: string; fn: EasingFn }>;

export type EasingPreset = keyof typeof EASING_PRESETS;
export type EasingChoice = EasingPreset | "custom";

export const CURVE_INTERPOLATION = "smooth" as const;

/** Curve control value model: points per channel; easing uses the RGB channel only. */
export type CurveValue = { points?: { RGB?: readonly { x: number; y: number }[] } };

export function resolveEasing(choice: string, curve: CurveValue | undefined): EasingFn {
  if (choice === "custom") {
    const points = curve?.points?.RGB;
    if (points && points.length >= 2) return createCurveEvaluator(points, CURVE_INTERPOLATION);
    return EASING_PRESETS.linear.fn;
  }
  return (EASING_PRESETS as Record<string, { fn: EasingFn }>)[choice]?.fn ?? EASING_PRESETS["cubic-in-out"].fn;
}
