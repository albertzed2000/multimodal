import type { SpriteRect } from "@/components/SpriteAnimation";

// Shared geometry for the bundled cat sheet (public/sprites.png).
// The sheet is 1280x1280 in a 4x4 layout, but the frames are NOT on an even
// grid — each figure sits at a slightly different x/y inside its cell. These
// per-frame content centers were measured from the sheet so a fixed 320px
// window can be cropped centered on each one, keeping the cat planted instead
// of drifting between frames.
export const CAT_FRAME = 320;
export const CAT_SHEET_SIZE = 1280;

const HALF = CAT_FRAME / 2;
const MAX_ORIGIN = CAT_SHEET_SIZE - CAT_FRAME;

// [centerX, centerY] of each frame, in row-major order.
const FRAME_CENTERS: ReadonlyArray<readonly [number, number]> = [
  [202, 190], [499, 190], [792, 190], [1084, 190], // row 1 — idle
  [197, 480], [497, 479], [789, 479], [1075, 479], // row 2 — front walk
  [196, 774], [491, 774], [786, 774], [1080, 774], // row 3 — back walk
  [201, 1068], [494, 1068], [783, 1068], [1073, 1068], // row 4 — wave
];

const clamp = (v: number) => Math.max(0, Math.min(MAX_ORIGIN, v));

export const CAT_FRAME_RECTS: SpriteRect[] = FRAME_CENTERS.map(([cx, cy]) => ({
  x: clamp(cx - HALF),
  y: clamp(cy - HALF),
  width: CAT_FRAME,
  height: CAT_FRAME,
}));

/** Props to spread onto <SpriteAnimation> for the cat sheet. */
export const CAT_SHEET = {
  src: "/sprites.png",
  columns: 4,
  rows: 4,
  frameWidth: CAT_FRAME,
  frameHeight: CAT_FRAME,
  sheetWidth: CAT_SHEET_SIZE,
  sheetHeight: CAT_SHEET_SIZE,
  frameRects: CAT_FRAME_RECTS,
} as const;

/** Semantic frame ranges (inclusive) keyed by motion. */
export const CAT_CLIPS = {
  idle: [0, 0],
  frontWalk: [4, 7],
  backWalk: [8, 11],
  wave: [12, 15],
} as const satisfies Record<string, readonly [number, number]>;
