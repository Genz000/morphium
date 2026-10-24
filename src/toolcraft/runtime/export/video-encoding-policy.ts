import type { ToolcraftVideoExportFormat } from "./artifact-export-settings";
import { ToolcraftArtifactExportError } from "./export-error";

export const TOOLCRAFT_MAX_VIDEO_ARTIFACT_BYTES = 96 * 1024 * 1024;

export type ToolcraftVideoCodec = "avc" | "hevc" | "vp8" | "vp9";

export type ToolcraftVideoEncodingSupport = Readonly<{
  avc: boolean;
  hevc?: boolean;
  vp8: boolean;
  vp9: boolean;
}>;

/**
 * Constant-quality targets (FFmpeg CRF equivalents). The web-video defaults
 * (VP9 40, H.265 32) smear Morphium content: 1 px outlines, small labels and
 * the 3 px workspace dots at 10% contrast disappear. These levels keep that
 * line art while flat colour areas still compress to small files.
 * VP8 has no quantizer mode and stays bitrate-driven.
 */
export const TOOLCRAFT_VIDEO_CONSTANT_QUALITY: Readonly<Partial<Record<ToolcraftVideoCodec, number>>> = Object.freeze({
  avc: 20,
  hevc: 22,
  vp9: 30,
});

export type ToolcraftVideoEncodingPolicy = Readonly<{
  /** Fallback when the browser encoder cannot run in constant-quality mode. */
  bitrate: number;
  codec: ToolcraftVideoCodec;
  quantizer?: number;
  extension: ".mp4" | ".webm";
  mediaType: "video/mp4" | "video/webm";
}>;

type ToolcraftVideoEncodingCandidate = Readonly<{
  codec: ToolcraftVideoCodec;
  extension: ".mp4" | ".webm";
  mediaType: "video/mp4" | "video/webm";
}>;

// MP4 prefers H.265 (written as hvc1 for Apple devices) and falls back to H.264.
const mp4Candidates: readonly ToolcraftVideoEncodingCandidate[] = Object.freeze([
  Object.freeze({ codec: "hevc", extension: ".mp4", mediaType: "video/mp4" }),
  Object.freeze({ codec: "avc", extension: ".mp4", mediaType: "video/mp4" }),
]);
const webmCandidates: readonly ToolcraftVideoEncodingCandidate[] = Object.freeze([
  Object.freeze({ codec: "vp9", extension: ".webm", mediaType: "video/webm" }),
  Object.freeze({ codec: "vp8", extension: ".webm", mediaType: "video/webm" }),
]);

export function getToolcraftVideoExportBitrate(
  width: number,
  height: number,
): number {
  return Math.max(
    2_000_000,
    Math.min(12_000_000, Math.round(width * height * 30 * 0.05)),
  );
}

function assertArtifactBudget(bitrate: number, durationSeconds: number): void {
  const projectedBytes = (bitrate * durationSeconds * 1.1) / 8;
  if (projectedBytes > TOOLCRAFT_MAX_VIDEO_ARTIFACT_BYTES) {
    throw new ToolcraftArtifactExportError({
      code: "video-artifact-too-large",
      message: "The selected video export exceeds Toolcraft's artifact limit.",
    });
  }
}

export function resolveToolcraftVideoEncodingPolicy({
  durationSeconds,
  height,
  requestedFormat,
  support,
  width,
}: Readonly<{
  durationSeconds: number;
  height: number;
  requestedFormat: ToolcraftVideoExportFormat;
  support: ToolcraftVideoEncodingSupport;
  width: number;
}>): ToolcraftVideoEncodingPolicy {
  const bitrate = getToolcraftVideoExportBitrate(width, height);
  assertArtifactBudget(bitrate, durationSeconds);
  const candidates =
    requestedFormat === "mp4"
      ? [...mp4Candidates, ...webmCandidates]
      : [...webmCandidates, ...mp4Candidates];
  const candidate = candidates.find((item) => support[item.codec] === true);

  if (!candidate) {
    throw new ToolcraftArtifactExportError({
      code: "video-encoder-unavailable",
      message: "This browser has no supported timestamped video encoder.",
    });
  }

  const quantizer = TOOLCRAFT_VIDEO_CONSTANT_QUALITY[candidate.codec];
  return Object.freeze({ ...candidate, bitrate, ...(quantizer === undefined ? {} : { quantizer }) });
}
