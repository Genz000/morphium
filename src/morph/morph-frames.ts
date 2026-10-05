import type { ToolcraftMediaAsset } from "@/toolcraft/runtime";

import { normalizeFrames } from "./morph-normalize";
import { FRAMES_TARGET, MAX_FRAMES } from "./morph-settings";
import { parseSvgFrame } from "./morph-svg";
import type { FitMode, MorphFrame, Subpath } from "./morph-types";

/** Enforced per-frame boundary: files above this many segments are rejected instead of slowing every frame. */
export const MAX_SEGMENTS_PER_FRAME = 4000;

export type FrameAsset = { id: string; fileName: string; resourceRef: string };

/** Ready SVG files attached to the Frames uploader, in runtime media order. */
export function frameAssets(mediaAssets: readonly ToolcraftMediaAsset[]): FrameAsset[] {
  return mediaAssets
    .filter((a) => a.assetKind === "file" && a.sourceTarget === FRAMES_TARGET && a.lifecycle === "ready")
    .slice(0, MAX_FRAMES)
    .map((a) => ({ id: a.id, fileName: a.fileName, resourceRef: (a as { resourceRef: string }).resourceRef }));
}

export const framesKey = (assets: readonly FrameAsset[]) => assets.map((a) => a.resourceRef).join("|");

/** A decoded frame, or the reason the file could not be used. */
export type FrameEntry = MorphFrame | { error: string };

const parsed = new Map<string, FrameEntry>();

export function parseFrameText(text: string, fileName: string): MorphFrame {
  const frame = parseSvgFrame(text, fileName);
  if (!frame.subs.length) throw new Error(`${fileName}: no vector shapes found`);
  const segments = frame.subs.reduce((n, s) => n + s.segs.length, 0);
  if (segments > MAX_SEGMENTS_PER_FRAME) {
    throw new Error(`${fileName}: ${segments} segments; the limit is ${MAX_SEGMENTS_PER_FRAME} per frame`);
  }
  return frame;
}

/** Decodes and caches each attached file once per resource. */
export async function decodeFrames(
  assets: readonly FrameAsset[], urls: ReadonlyMap<string, string>,
  parse: (text: string, fileName: string) => MorphFrame = parseFrameText,
): Promise<readonly FrameEntry[]> {
  const out: FrameEntry[] = [];
  for (const asset of assets) {
    let entry = parsed.get(asset.resourceRef);
    if (!entry) {
      const url = urls.get(asset.id);
      if (!url) return [];
      const text = await readText(url);
      entry = text === null ? { error: `${asset.fileName}: file could not be read` } : parseEntry(text, asset.fileName, parse);
      parsed.set(asset.resourceRef, entry);
    }
    out.push(entry);
  }
  return out;
}

async function readText(url: string): Promise<string | null> {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) return null;
  return response.text().catch(() => null);
}

function parseEntry(text: string, fileName: string, parse: (text: string, fileName: string) => MorphFrame): FrameEntry {
  try {
    return parse(text, fileName);
  } catch (error) {
    return { error: error instanceof Error ? error.message : `${fileName}: not a usable SVG` };
  }
}

export const isFrame = (entry: FrameEntry): entry is MorphFrame => !("error" in entry);

export function cachedFrames(assets: readonly FrameAsset[]): MorphFrame[] | null {
  const frames: MorphFrame[] = [];
  for (const asset of assets) {
    const entry = parsed.get(asset.resourceRef);
    if (!entry) return null;
    if (isFrame(entry)) frames.push(entry);
  }
  return frames;
}

let lastNormalized: { key: string; result: Subpath[][] } | null = null;

/** Normalisation is memoised on frame identity and fit mode; playback reuses it. */
export function normalizedFrames(frames: readonly MorphFrame[], key: string, fit: FitMode): Subpath[][] {
  const fullKey = `${key}#${fit}`;
  if (lastNormalized?.key === fullKey) return lastNormalized.result;
  const result = normalizeFrames(frames, fit);
  lastNormalized = { key: fullKey, result };
  return result;
}
