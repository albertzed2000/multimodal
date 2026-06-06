"use client";

import { useRef, useState } from "react";
import {
  SpriteAnimation,
  type SpriteAnimationHandle,
  type SpriteClips,
  type SpriteRect,
} from "@/components/SpriteAnimation";

// The bundled cat sheet is 1280x1280 with a 4x4 layout, but the frames are NOT
// on an even grid — each figure sits at a slightly different x/y inside its
// cell. These per-frame content centers were measured from the sheet so we can
// crop a fixed 320px window centered on each one, keeping the character planted
// instead of drifting between frames.
const FRAME = 320;
const SHEET_SIZE = 1280;
const HALF = FRAME / 2;
const MAX_ORIGIN = SHEET_SIZE - FRAME;

// [centerX, centerY] of each frame, in row-major order.
const FRAME_CENTERS: ReadonlyArray<readonly [number, number]> = [
  [202, 190], [499, 190], [792, 190], [1084, 190], // row 1 — idle
  [197, 480], [497, 479], [789, 479], [1075, 479], // row 2 — front walk
  [196, 774], [491, 774], [786, 774], [1080, 774], // row 3 — back walk
  [201, 1068], [494, 1068], [783, 1068], [1073, 1068], // row 4 — wave
];

const clamp = (v: number) => Math.max(0, Math.min(MAX_ORIGIN, v));

const frameRects: SpriteRect[] = FRAME_CENTERS.map(([cx, cy]) => ({
  x: clamp(cx - HALF),
  y: clamp(cy - HALF),
  width: FRAME,
  height: FRAME,
}));

const SHEET = {
  src: "/sprites.png",
  columns: 4,
  rows: 4,
  frameWidth: FRAME,
  frameHeight: FRAME,
  sheetWidth: SHEET_SIZE,
  sheetHeight: SHEET_SIZE,
  frameRects,
} as const;

const clips: SpriteClips = {
  Idle: [0, 0],
  "Front walk": [4, 7],
  "Back walk": [8, 11],
  Wave: [12, 15],
};

export default function SpriteDemoPage() {
  const [clip, setClip] = useState<string>("Idle");
  const [fps, setFps] = useState(8);
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [frame, setFrame] = useState(0);
  const handle = useRef<SpriteAnimationHandle>(null);

  return (
    <main className="min-h-screen px-5 py-10 md:px-10">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.22em] text-[#e9c46a]">Component preview</p>
        <h1 className="mt-2 text-4xl font-semibold">SpriteAnimation</h1>
        <p className="mt-3 max-w-xl leading-7 text-white/66">
          A reusable, frame-based sprite player driven by{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">
            requestAnimationFrame
          </code>
          . Pick a clip, scrub the speed, and pause/loop to see it work.
        </p>

        <div className="mt-8 grid items-start gap-8 md:grid-cols-[auto_1fr]">
          <div className="grid place-items-center rounded-lg border border-white/12 bg-black/30 p-6">
            <SpriteAnimation
              ref={handle}
              {...SHEET}
              clips={clips}
              clip={clip}
              fps={fps}
              playing={playing}
              loop={loop}
              scale={0.75}
              onFrameChange={setFrame}
              style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.45))" }}
            />
            <p className="mt-4 font-mono text-sm text-white/45">
              local frame: {frame}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-white/60">Clip</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(clips).map((name) => (
                  <button
                    key={name}
                    onClick={() => setClip(name)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      clip === name
                        ? "border-[#e9c46a] bg-[#e9c46a]/15 text-[#f4d58a]"
                        : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/60">Speed: {fps} fps</label>
              <input
                type="range"
                min={1}
                max={24}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full accent-[#2a9d8f]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="rounded-md bg-[#f4a261] px-4 py-2 font-semibold text-black transition hover:bg-[#e9c46a]"
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => handle.current?.restart()}
                className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-2 transition hover:border-white/30"
              >
                Restart
              </button>
              <button
                onClick={() => setLoop((l) => !l)}
                className={`rounded-md border px-4 py-2 transition ${
                  loop
                    ? "border-[#2a9d8f] bg-[#2a9d8f]/15 text-[#9be3d9]"
                    : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"
                }`}
              >
                Loop: {loop ? "on" : "off"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
