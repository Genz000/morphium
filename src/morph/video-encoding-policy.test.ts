import { describe, expect, it } from "vitest";

import { resolveToolcraftVideoEncodingPolicy } from "@/toolcraft/runtime/export/video-encoding-policy";

const base = { durationSeconds: 6.8, width: 1920, height: 1080 } as const;
const all = { avc: true, hevc: true, vp8: true, vp9: true };

describe("web-optimized video encoding", () => {
  it("encodes MP4 as H.265 at constant quality 32", () => {
    expect(resolveToolcraftVideoEncodingPolicy({ ...base, requestedFormat: "mp4", support: all }))
      .toMatchObject({ codec: "hevc", quantizer: 32, mediaType: "video/mp4", extension: ".mp4" });
  });
  it("falls back to H.264 at constant quality 28 without H.265", () => {
    expect(resolveToolcraftVideoEncodingPolicy({ ...base, requestedFormat: "mp4", support: { ...all, hevc: false } }))
      .toMatchObject({ codec: "avc", quantizer: 28, mediaType: "video/mp4" });
  });
  it("encodes WebM as VP9 at constant quality 40", () => {
    expect(resolveToolcraftVideoEncodingPolicy({ ...base, requestedFormat: "webm", support: all }))
      .toMatchObject({ codec: "vp9", quantizer: 40, mediaType: "video/webm" });
  });
  it("keeps VP8 bitrate-driven and always provides a bitrate fallback", () => {
    const vp8 = resolveToolcraftVideoEncodingPolicy({ ...base, requestedFormat: "webm", support: { avc: false, hevc: false, vp8: true, vp9: false } });
    expect(vp8.codec).toBe("vp8");
    expect(vp8.quantizer).toBeUndefined();
    expect(vp8.bitrate).toBeGreaterThan(0);
  });
});
