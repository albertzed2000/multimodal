"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";

/**
 * A named range of frames inside the sheet, e.g. { idle: [0, 3] }.
 * Both ends are inclusive and indexed left-to-right, top-to-bottom.
 */
export type SpriteClips = Record<string, readonly [number, number]>;

/** A source rectangle (in native sheet pixels) for a single frame. */
export type SpriteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpriteAnimationHandle = {
  /** Restart the current clip from its first frame. */
  restart: () => void;
  /** Jump to an absolute frame index on the sheet. */
  goTo: (frame: number) => void;
};

export type SpriteAnimationProps = {
  /** URL of the sprite sheet (defaults to the bundled cat sheet in /public). */
  src?: string;
  /** Number of frame columns in the sheet. */
  columns: number;
  /** Number of frame rows in the sheet. */
  rows: number;
  /** Native pixel width of a single frame. */
  frameWidth: number;
  /** Native pixel height of a single frame. */
  frameHeight: number;
  /**
   * Natural pixel size of the whole sheet. Defaults to
   * columns * frameWidth by rows * frameHeight (correct for an even grid).
   * Provide the real values when using `frameRects` on an irregular sheet.
   */
  sheetWidth?: number;
  sheetHeight?: number;
  /**
   * Explicit source rectangles per absolute frame index. Use this for sheets
   * whose frames are not on an even grid; when omitted, frames are derived
   * from columns/rows/frameWidth/frameHeight.
   */
  frameRects?: readonly SpriteRect[];
  /**
   * Total usable frames. Defaults to columns * rows. Set this lower when the
   * last cells of the grid are empty/padding.
   */
  frameCount?: number;
  /**
   * Explicit playback order of absolute frame indices. Overrides the
   * sequential 0..frameCount-1 ordering and any `clip`/`frameRange`.
   */
  frames?: readonly number[];
  /** Named clips; pick one to play with the `clip` prop. */
  clips?: SpriteClips;
  /** Name of the clip (from `clips`) to play. */
  clip?: string;
  /** Inclusive [start, end] absolute frame range to play. */
  frameRange?: readonly [number, number];
  /** Frames per second. */
  fps?: number;
  /** Whether the animation is advancing. */
  playing?: boolean;
  /** Loop when reaching the end of the sequence. */
  loop?: boolean;
  /** Uniform scale applied to the frame size. */
  scale?: number;
  /** Explicit rendered width in px (overrides scale for width). */
  width?: number;
  /** Explicit rendered height in px (overrides scale for height). */
  height?: number;
  /** CSS image-rendering, use "pixelated" for pixel art. */
  imageRendering?: CSSProperties["imageRendering"];
  /** Fired with the local sequence index whenever the frame changes. */
  onFrameChange?: (index: number) => void;
  /** Fired once when a non-looping animation reaches its final frame. */
  onComplete?: () => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SpriteAnimationHandle>;
};

function resolveSequence(
  props: Pick<
    SpriteAnimationProps,
    "frames" | "clips" | "clip" | "frameRange" | "frameCount" | "columns" | "rows"
  >,
): number[] {
  const { frames, clips, clip, frameRange, columns, rows } = props;
  const total = props.frameCount ?? columns * rows;

  if (frames && frames.length > 0) {
    return [...frames];
  }

  let range: readonly [number, number] | undefined = frameRange;
  if (!range && clip && clips && clips[clip]) {
    range = clips[clip];
  }

  if (range) {
    const [start, end] = range;
    const out: number[] = [];
    const step = end >= start ? 1 : -1;
    for (let f = start; step > 0 ? f <= end : f >= end; f += step) {
      out.push(f);
    }
    return out;
  }

  return Array.from({ length: total }, (_, i) => i);
}

/**
 * Renders a frame of a sprite sheet and animates through a sequence using a
 * requestAnimationFrame loop. Works with any uniform grid sheet and supports
 * named clips, explicit frame orders, play/pause, looping, and scaling.
 */
export function SpriteAnimation({
  src = "/sprites.png",
  columns,
  rows,
  frameWidth,
  frameHeight,
  sheetWidth,
  sheetHeight,
  frameRects,
  frameCount,
  frames,
  clips,
  clip,
  frameRange,
  fps = 12,
  playing = true,
  loop = true,
  scale = 1,
  width,
  height,
  imageRendering = "auto",
  onFrameChange,
  onComplete,
  className,
  style,
  ref,
}: SpriteAnimationProps) {
  const sequence = resolveSequence({
    frames,
    clips,
    clip,
    frameRange,
    frameCount,
    columns,
    rows,
  });
  const sequenceKey = sequence.join(",");
  const length = sequence.length;

  const [index, setIndex] = useState(0);

  // Reset to the first frame whenever the sequence itself changes, using the
  // "store previous value during render" pattern (no effect needed).
  const [prevSequenceKey, setPrevSequenceKey] = useState(sequenceKey);
  if (prevSequenceKey !== sequenceKey) {
    setPrevSequenceKey(sequenceKey);
    setIndex(0);
  }

  // Mirror of the committed index plus the latest callbacks, kept in sync via
  // an effect so the rAF loop can read them without re-subscribing.
  const indexRef = useRef(0);
  const onFrameChangeRef = useRef(onFrameChange);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    indexRef.current = index;
    onFrameChangeRef.current = onFrameChange;
    onCompleteRef.current = onComplete;
  });

  useImperativeHandle(
    ref,
    () => ({
      restart() {
        setIndex(0);
        onFrameChangeRef.current?.(0);
      },
      goTo(frame: number) {
        const local = sequence.indexOf(frame);
        const next = local >= 0 ? local : 0;
        setIndex(next);
        onFrameChangeRef.current?.(next);
      },
    }),
    [sequenceKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!playing || length <= 1 || fps <= 0) {
      return;
    }

    const frameDuration = 1000 / fps;
    let rafId = 0;
    let last = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      accumulator += now - last;
      last = now;

      while (accumulator >= frameDuration) {
        accumulator -= frameDuration;
        const next = indexRef.current + 1;

        if (next >= length) {
          if (loop) {
            indexRef.current = 0;
            setIndex(0);
            onFrameChangeRef.current?.(0);
          } else {
            indexRef.current = length - 1;
            setIndex(length - 1);
            onCompleteRef.current?.();
            return; // stop without scheduling another frame
          }
        } else {
          indexRef.current = next;
          setIndex(next);
          onFrameChangeRef.current?.(next);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, fps, loop, length, sequenceKey]);

  const absoluteFrame = sequence[index] ?? 0;

  // Resolve the source rectangle for this frame: either an explicit rect (for
  // irregular sheets) or the even-grid cell derived from columns/rows.
  const rect: SpriteRect = frameRects?.[absoluteFrame] ?? {
    x: (absoluteFrame % columns) * frameWidth,
    y: Math.floor(absoluteFrame / columns) * frameHeight,
    width: frameWidth,
    height: frameHeight,
  };

  const sheetW = sheetWidth ?? columns * frameWidth;
  const sheetH = sheetHeight ?? rows * frameHeight;

  const renderWidth = width ?? rect.width * scale;
  const renderHeight = height ?? rect.height * scale;

  // Scale the whole sheet so the frame's source rect maps onto the render box,
  // then shift it so the rect's top-left aligns with the box origin. Pixel math
  // (rather than percentages) keeps cropping exact on non-uniform sheets.
  const scaleX = renderWidth / rect.width;
  const scaleY = renderHeight / rect.height;

  return (
    <div
      className={className}
      role="img"
      style={{
        width: renderWidth,
        height: renderHeight,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheetW * scaleX}px ${sheetH * scaleY}px`,
        backgroundPosition: `${-rect.x * scaleX}px ${-rect.y * scaleY}px`,
        imageRendering,
        ...style,
      }}
    />
  );
}

export default SpriteAnimation;
