import { useEffect, useMemo, useRef } from "react";

import { getToolcraftTimelineLoopProgress } from "@/toolcraft/runtime";
import {
  useToolcraftMediaPresentationUrls, useToolcraftPipelinePass, useToolcraftProductSceneFrame,
  useToolcraftDispatch, useToolcraftSelector, useToolcraftViewportInteractionActive,
} from "@/toolcraft/runtime/react";

import { decodeFrames, frameAssets, framesKey, isFrame, normalizedFrames, type FrameEntry } from "./morph-frames";
import { decodePass, normalizePass, scenePass } from "./morph-pipeline";
import { MorphOverlays } from "./MorphOverlays";
import { readMorphSettings } from "./morph-settings";
import { keyOrder } from "./morph-sequence";
import { contrastInk, pathData, shapeAtProgress, stageMap } from "./morph-scene";
import type { MorphFrame } from "./morph-types";
import styles from "./morph.module.css";

const EMPTY: readonly FrameEntry[] = [];

export function MorphCanvas() {
  const frame = useToolcraftProductSceneFrame();
  const values = useToolcraftSelector((state) => state.values);
  const media = useToolcraftSelector((state) => state.mediaAssets);
  const currentTimeSeconds = useToolcraftSelector((state) => state.timeline.currentTimeSeconds);
  const durationSeconds = useToolcraftSelector((state) => state.timeline.durationSeconds);
  const viewportActive = useToolcraftViewportInteractionActive();
  const settings = useMemo(() => readMorphSettings(values), [values]);
  const background = String(values["appearance.background"] ?? "#F4F1EA");
  const assets = useMemo(() => frameAssets(media), [media]);
  const urls = useToolcraftMediaPresentationUrls(media);
  const ready = assets.every((asset) => urls.has(asset.id));
  const key = framesKey(assets);

  const decoded = useToolcraftPipelinePass(decodePass, { resources: ready ? key : `pending:${key}` }, () =>
    ready ? decodeFrames(assets, urls) : EMPTY);
  const frames = useMemo(
    () => (decoded.status === "success" ? decoded.result.filter(isFrame) : []),
    [decoded],
  );
  const decodedKey = decoded.status === "success" && ready ? key : "";
  const normalized = useToolcraftPipelinePass(normalizePass, { resources: decodedKey, fit: settings.fit }, () =>
    frames.length ? normalizedFrames(frames, decodedKey, settings.fit) : []);

  // Delay and Duration own the speed: keep the timeline one full loop long.
  const dispatch = useToolcraftDispatch();
  const steps = Math.max(1, keyOrder(frames.length, settings.sequence).length - 1);
  const loopSeconds = Math.min(60, Math.max(0.1, (steps * (settings.delay + settings.duration)) / 1000));
  useEffect(() => {
    if (frames.length > 1 && Math.abs(loopSeconds - durationSeconds) > 0.001) {
      dispatch({ type: "timeline.setDuration", durationSeconds: loopSeconds } as never);
    }
  }, [dispatch, frames.length, loopSeconds, durationSeconds]);

  // Viewport pan/zoom holds the last drawn time instead of advancing playback work.
  const heldProgress = useRef(0);
  const liveProgress = getToolcraftTimelineLoopProgress({ currentTimeSeconds, durationSeconds });
  if (!viewportActive) heldProgress.current = liveProgress;
  const progress = heldProgress.current;

  const rect = frame.kind === "ready" ? frame.rect : null;
  const norm = normalized.status === "success" ? normalized.result : [];
  const sceneKey = `${decodedKey}#${settings.fit}#${progress}#${rect?.width}x${rect?.height}#${JSON.stringify(settings)}`;
  const scene = useToolcraftPipelinePass(scenePass, { scene: sceneKey }, () => sceneKey);
  const { shape, phase } = useMemo(() => shapeAtProgress(norm, progress, settings), [norm, progress, settings]);

  if (!rect) return null;
  const local = { x: 0, y: 0, width: rect.width, height: rect.height };
  const map = frames.length ? stageMap(frames[0].viewBox, local) : null;
  const ui = Math.min(rect.width, rect.height) / 600;
  const d = pathData(shape);
  const frameReady = scene.status === "success" && normalized.status === "success" && Boolean(map);

  return (
    <svg
      className={styles.output}
      viewBox={`0 0 ${rect.width} ${rect.height}`}
      overflow="visible"
      data-testid="morph-output"
      data-toolcraft-product-output=""
      data-frame-ready={frameReady ? "true" : "false"}
      data-frame-count={frames.length}
      data-cycle-seconds={durationSeconds}
      data-loop-progress={progress.toFixed(4)}
      data-phase={phase.holding ? `frame-${phase.a + 1}` : `${phase.a + 1}-${phase.b + 1}`}
      aria-label="Morph preview"
    >
      {map && d ? (
        <g transform={`matrix(${map.s} 0 0 ${map.s} ${map.ox} ${map.oy})`}>
          {settings.outline ? (
            <path data-testid="morph-shape" d={d} fill="none" stroke={contrastInk(background)} strokeWidth={ui / map.s} />
          ) : (
            <path
              data-testid="morph-shape" d={d} fillRule="evenodd"
              fill={settings.fillOn ? settings.fill : "none"}
              stroke={settings.strokeWidth > 0 ? settings.stroke : "none"}
              strokeWidth={settings.strokeWidth} strokeLinejoin={settings.lineJoin} strokeLinecap="round" strokeMiterlimit={8}
            />
          )}
        </g>
      ) : null}
      {map ? <MorphOverlays shape={shape} map={map} settings={settings} ui={ui} /> : null}
    </svg>
  );
}
