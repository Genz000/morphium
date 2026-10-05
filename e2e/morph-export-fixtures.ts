/**
 * Expected export pixels for the demo frames. The first frame's 400×400 viewBox
 * is contained in the 16:9 artboard, so it spans the full height, centred.
 * Circle r=120 → x 0.3313..0.6688, y 0.2..0.8 of the image.
 */
export const BACKGROUND_RGBA = [244, 241, 234, 255] as const;
export const FILL_RGBA = [20, 20, 20, 255] as const;

export const circleBounds = { x: 0.3313, y: 0.2, width: 0.3375, height: 0.6 };

export const circlePixels = [
  { xRatio: 0.5, yRatio: 0.5, rgba: FILL_RGBA },
  { xRatio: 0.03, yRatio: 0.05, rgba: BACKGROUND_RGBA },
];

/** (200,120) in frame coordinates is inside every demo frame and outside the ring's hole. */
export const insideEveryFrame = [
  { xRatio: 0.5, yRatio: 0.3, rgba: FILL_RGBA },
  { xRatio: 0.03, yRatio: 0.05, rgba: BACKGROUND_RGBA },
];

export const oneSecondSchedule = Array.from({ length: 30 }, (_, index) => ({ index, timeSeconds: index / 30, durationSeconds: 1 / 30 }));

export const videoSamples = [0, 15, 29].map((i) => ({ timeSeconds: oneSecondSchedule[i]!.timeSeconds, pixels: insideEveryFrame }));
