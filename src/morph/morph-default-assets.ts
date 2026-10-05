import type { ToolcraftDefaultMediaAssetSchema } from "@/toolcraft/runtime";

import { FRAMES_TARGET } from "./morph-settings";

export function starPath(cx: number, cy: number, outer: number, inner: number, points: number) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, r = i % 2 ? inner : outer;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/** The four demo frames the original page loaded on start. */
export const DEMO_FRAMES: readonly (readonly [fileName: string, svg: string])[] = [
  ["circle.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="120"/></svg>'],
  ["star.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="${starPath(200, 210, 150, 62, 5)}"/></svg>`],
  ["blob.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M200 62C268 58 340 104 338 176C336 238 300 250 304 300C308 346 252 352 206 338C160 324 128 352 92 318C58 286 80 238 70 192C58 132 128 66 200 62Z"/></svg>'],
  ["ring.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect x="80" y="80" width="240" height="240" rx="48"/><circle cx="200" cy="200" r="60"/></svg>'],
];

const toDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

export const defaultFrameAssets: readonly ToolcraftDefaultMediaAssetSchema[] = DEMO_FRAMES.map(([fileName, svg], i) => ({
  assetKind: "file",
  dataUrl: toDataUrl(svg),
  fileName,
  id: `demo-frame-${i + 1}`,
  mimeType: "image/svg+xml",
  sourceTarget: FRAMES_TARGET,
}));
