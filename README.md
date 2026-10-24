# Morphium

Animate between SVG shapes. Upload up to five SVG frames and Morphium morphs one into the next, with the bézier anchors, handles and their coordinates drawn over the shape.

**Try it:** https://genz000.github.io/morphium/ (desktop browser, window at least 1024 px wide)

## What it does

- Morphs between up to 5 uploaded SVG frames, in the order of the file list
- Loop, ping-pong or once (ends on the last frame) sequence, delay and duration in ms, 20 easing presets or a custom curve
- Outline view, fill and stroke colour, stroke width and line join
- A separate look for the last frame (solid fill or outline), with the option to hide its anchors and handles and to hold it longer (Last frame hold, in ms)
- Anchors and bézier handles on or off, with x, y coordinates in the first frame's SVG units
- Background colour, editable canvas size
- Export PNG/JPG (2K, 4K, 8K) and web-optimized video of one full loop: MP4 as H.265 (hvc1, faststart; H.264 where the browser cannot encode H.265) and WebM as VP9, both at constant quality with no audio track; with Background off, exports can use the same dotted workspace you see in the preview

## How to use

1. Add frames in **Frames**: click *Add a new file* or drop SVG files on the canvas. Drag files to reorder, × to remove. The reset icon on the section brings back the demo frames.
2. Turn on **Timeline** in **Settings** to scrub, play/pause and set the duration (shorter is faster). **Hold** in **Motion** sets how long each frame rests.
3. Pick an easing in **Motion**, or choose *Custom curve* and drag the curve points.
4. Style the shape in **Shape**, and the overlays in **Display**. Turn on *Show in export* to include anchors and labels in exported files.
5. Choose format and size in **Image Export** / **Video Export** and use the export buttons at the bottom of the panel. Images capture the frame under the playhead; video captures one loop.

Morphium reads path, rect, circle, ellipse, line, polyline, polygon and `<use>` elements, with transforms and arcs. Gradients, text, masks and embedded images are ignored. A single frame can have up to 4,000 path segments.

## Run locally

```bash
npm install
npm run dev
```

## Author

Made by Nader Boulaich — [naderboulaich.net](https://naderboulaich.net).

Third-party code included in this repository keeps its own license; see `LICENSE.md` and `NOTICE.md`.
