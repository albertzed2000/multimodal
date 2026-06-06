"use client";

import { useRef, useState } from "react";
import {
  SpriteAnimation,
  type SpriteAnimationHandle,
  type SpriteClips,
} from "@/components/SpriteAnimation";
import { CAT_CLIPS, CAT_SHEET } from "@/lib/catSprite";

const SHEET = CAT_SHEET;

const clips: SpriteClips = {
  Idle: CAT_CLIPS.idle,
  "Front walk": CAT_CLIPS.frontWalk,
  "Back walk": CAT_CLIPS.backWalk,
  Wave: CAT_CLIPS.wave,
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
