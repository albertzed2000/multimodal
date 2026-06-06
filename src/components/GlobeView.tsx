"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { CAT_CLIPS, CAT_SHEET } from "@/lib/catSprite";

export type GlobeMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  emoji: string;
};

type Props = {
  markers: GlobeMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Draw a cute hand-painted-style planet texture onto a canvas */
function buildGlobeTexture(): HTMLCanvasElement {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;

  // Ocean base — soft teal
  const ocean = ctx.createLinearGradient(0, 0, size, size);
  ocean.addColorStop(0, "#a8dfd4");
  ocean.addColorStop(0.5, "#84cfc4");
  ocean.addColorStop(1, "#9ad4e8");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);

  // Add soft wave shimmer lines
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 18; i++) {
    const y = (i / 18) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 40) {
      ctx.quadraticCurveTo(x + 20, y + 6, x + 40, y);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Land blobs — soft sage/green
  const lands = [
    { cx: 0.28, cy: 0.30, rx: 0.18, ry: 0.14, r: Math.PI * 0.1 },
    { cx: 0.58, cy: 0.25, rx: 0.20, ry: 0.16, r: -Math.PI * 0.05 },
    { cx: 0.72, cy: 0.60, rx: 0.10, ry: 0.12, r: Math.PI * 0.2 },
    { cx: 0.38, cy: 0.68, rx: 0.14, ry: 0.10, r: Math.PI * 0.15 },
    { cx: 0.82, cy: 0.35, rx: 0.09, ry: 0.07, r: 0 },
    { cx: 0.15, cy: 0.65, rx: 0.08, ry: 0.07, r: -Math.PI * 0.1 },
  ];

  for (const land of lands) {
    ctx.save();
    ctx.translate(land.cx * size, land.cy * size);
    ctx.rotate(land.r);

    // Shadow
    const shadow = ctx.createRadialGradient(4, 6, 0, 0, 0, land.rx * size);
    shadow.addColorStop(0, "rgba(80,120,80,0.18)");
    shadow.addColorStop(1, "rgba(80,120,80,0)");
    ctx.fillStyle = shadow;
    ctx.scale(1, land.ry / land.rx);
    ctx.beginPath();
    ctx.arc(0, 0, land.rx * size * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(1, land.rx / land.ry);

    // Land fill
    const landGrad = ctx.createRadialGradient(-land.rx * size * 0.3, -land.ry * size * 0.3, 0, 0, 0, land.rx * size);
    landGrad.addColorStop(0, "#b4de9a");
    landGrad.addColorStop(0.6, "#93c47d");
    landGrad.addColorStop(1, "#7ab566");
    ctx.scale(1, land.ry / land.rx);
    ctx.beginPath();
    ctx.arc(0, 0, land.rx * size, 0, Math.PI * 2);
    ctx.fillStyle = landGrad;
    ctx.fill();

    // Highlight
    ctx.globalAlpha = 0.35;
    ctx.scale(1, land.rx / land.ry);
    ctx.beginPath();
    ctx.ellipse(-land.rx * size * 0.25, -land.ry * size * 0.28, land.rx * size * 0.38, land.ry * size * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#dff2c8";
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // Soft cloud puffs
  const clouds = [
    { x: 0.18, y: 0.18, w: 0.12, h: 0.04 },
    { x: 0.55, y: 0.48, w: 0.09, h: 0.032 },
    { x: 0.78, y: 0.22, w: 0.10, h: 0.035 },
    { x: 0.42, y: 0.80, w: 0.08, h: 0.03 },
  ];
  ctx.globalAlpha = 0.55;
  for (const cl of clouds) {
    ctx.save();
    ctx.translate(cl.x * size, cl.y * size);
    ctx.scale(cl.w * size / 60, cl.h * size / 20);
    for (const [ox, oy, r] of [[-20, 0, 18], [0, -5, 22], [22, 0, 17], [-5, 6, 15]] as [number, number, number][]) {
      const cg = ctx.createRadialGradient(ox, oy - r * 0.3, 0, ox, oy, r);
      cg.addColorStop(0, "#ffffff");
      cg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  return c;
}

function makeBadge(marker: GlobeMarker, onClickId: (id: string) => void) {
  const color = marker.color;
  const PIN_W = 40;
  const PIN_H = 52;
  // The pin SVG's head circle is centered at viewBox (20, 19); use the same
  // coordinates (in px) to anchor the emoji exactly on that center.
  const HEAD_CY = 19;

  const wrap = document.createElement("div");
  // globe.gl renders HTML markers on an overlay layer with pointer-events:none.
  // Opt this marker back into hit-testing so clicks reach onClickId().
  wrap.style.cssText = `position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;pointer-events:auto;`;

  // Always-visible label sitting above the pin.
  const tag = document.createElement("div");
  tag.style.cssText = `
    margin-bottom:4px; padding:2px 8px;
    background:white; border:2px solid ${color}; border-radius:14px;
    font-size:9px; font-weight:700; color:#4a3f35;
    white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.12);
    letter-spacing:0.03em; font-family:system-ui, sans-serif;
    pointer-events:none;
  `;
  tag.textContent = marker.label;

  // Location-pin shape (teardrop with a circular hole), tinted per node.
  const pin = document.createElement("div");
  pin.style.cssText = `position:relative;width:${PIN_W}px;height:${PIN_H}px;transform-origin:50% 100%;transition:transform 0.2s cubic-bezier(.34,1.56,.64,1);filter:drop-shadow(0 5px 5px rgba(40,40,70,0.32));`;
  pin.innerHTML = `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 1 C9.5 1 1 9.5 1 19.5 C1 32.5 20 51 20 51 C20 51 39 32.5 39 19.5 C39 9.5 30.5 1 20 1 Z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="20" cy="19" r="9" fill="#ffffff"/>
  </svg>`;

  // Emoji centered exactly on the pin head circle.
  const emoji = document.createElement("div");
  emoji.textContent = marker.emoji;
  emoji.style.cssText = `position:absolute;left:0;width:100%;top:${HEAD_CY}px;transform:translateY(-50%);text-align:center;font-size:14px;line-height:1;pointer-events:none;`;
  pin.appendChild(emoji);

  wrap.appendChild(tag);
  wrap.appendChild(pin);

  wrap.addEventListener("click", () => onClickId(marker.id));
  wrap.addEventListener("mouseenter", () => {
    pin.style.transform = "scale(1.18) translateY(-3px)";
  });
  wrap.addEventListener("mouseleave", () => {
    pin.style.transform = "scale(1)";
  });

  return wrap;
}

type Vec = { x: number; y: number };

const MARKER_ALTITUDE = 0.04;

export default function GlobeView({ markers, selectedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [clipRange, setClipRange] = useState<readonly [number, number]>(CAT_CLIPS.idle);

  // Walk/animation state lives in refs so the rAF loop always reads fresh data.
  const posRef = useRef<Vec | null>(null);
  const targetRef = useRef<Vec | "center" | null>(null);
  const walkingRef = useRef(false);
  const onArriveRef = useRef<(() => void) | null>(null);
  const arrivedRef = useRef(false);
  const chooseRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    if (!mountRef.current || globeRef.current) return;
    let cancelled = false;
    let raf = 0;
    let last = performance.now();

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeGL: any = await import("globe.gl").then((m) => m.default ?? m);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE: any = await import("three");

      if (cancelled || !mountRef.current) return;
      const el = mountRef.current;

      // Build pastel canvas texture
      const texCanvas = buildGlobeTexture();
      const texture = new THREE.CanvasTexture(texCanvas);

      // Toon gradient map for flat cel shading
      const gradCanvas = document.createElement("canvas");
      gradCanvas.width = 2; gradCanvas.height = 1;
      const gctx = gradCanvas.getContext("2d")!;
      gctx.fillStyle = "#ffffff"; gctx.fillRect(0, 0, 1, 1);
      gctx.fillStyle = "#cccccc"; gctx.fillRect(1, 0, 1, 1);
      const gradMap = new THREE.CanvasTexture(gradCanvas);
      gradMap.minFilter = THREE.NearestFilter;
      gradMap.magFilter = THREE.NearestFilter;

      const mat = new THREE.MeshToonMaterial({ map: texture, gradientMap: gradMap });

      const instance = GlobeGL({
        animateIn: true,
        rendererConfig: { antialias: true, alpha: true },
      })(el);

      instance
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(null)
        .globeMaterial(mat)
        .atmosphereColor("#c8f0ff")
        .atmosphereAltitude(0.22)
        .showGraticules(false)
        .htmlElementsData(markers)
        .htmlElement((d: unknown) =>
          makeBadge(d as GlobeMarker, (id) => chooseRef.current?.(id)),
        )
        .htmlLat((d: unknown) => (d as GlobeMarker).lat)
        .htmlLng((d: unknown) => (d as GlobeMarker).lng)
        .htmlAltitude(MARKER_ALTITUDE)
        .pointOfView({ lat: 18, lng: 0, altitude: 2.2 }, 0);

      // Keep the globe stationary so every node stays put and visible.
      const controls = instance.controls();
      controls.enableRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.autoRotate = false;

      // Warm pastel lighting
      const scene = instance.scene();
      scene.children
        .filter((c: { type: string }) => ["AmbientLight", "DirectionalLight"].includes(c.type))
        .forEach((l: { intensity: number }) => { l.intensity = 0; });
      scene.add(new THREE.AmbientLight(0xfff8f0, 1.6));
      const sun = new THREE.DirectionalLight(0xffeedd, 0.9);
      sun.position.set(4, 3, 2);
      scene.add(sun);

      // Spawn the cat in the middle of the globe.
      posRef.current = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
      if (spriteRef.current) {
        spriteRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
      }

      globeRef.current = { instance };
      setReady(true);

      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        const pos = posRef.current;
        if (pos) {
          const center = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
          const raw = targetRef.current;
          const tgt = raw === "center" ? center : raw;
          if (walkingRef.current && tgt) {
            const dx = tgt.x - pos.x;
            const dy = tgt.y - pos.y;
            const dist = Math.hypot(dx, dy);
            const step = 260 * dt;
            if (dist > step && dist > 1) {
              pos.x += (dx / dist) * step;
              pos.y += (dy / dist) * step;
            } else {
              pos.x = tgt.x;
              pos.y = tgt.y;
              walkingRef.current = false;
              const cb = onArriveRef.current;
              onArriveRef.current = null;
              cb?.();
            }
          }
          if (spriteRef.current) {
            spriteRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
          }
        }

        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send the cat walking toward a node. The globe is stationary and every node
  // is on the visible hemisphere, so the target screen position is stable —
  // just walk straight to it. Front walk heading down, back walk heading up.
  const choose = useCallback(
    (id: string) => {
      const api = globeRef.current?.instance;
      const marker = markers.find((m) => m.id === id);
      if (!api || !marker || walkingRef.current || !posRef.current) return;

      const sc = api.getScreenCoords(marker.lat, marker.lng, MARKER_ALTITUDE);
      if (!sc) return;

      arrivedRef.current = false;
      targetRef.current = { x: sc.x, y: sc.y };
      const dy = sc.y - posRef.current.y;
      setClipRange(dy >= 0 ? CAT_CLIPS.frontWalk : CAT_CLIPS.backWalk);
      onArriveRef.current = () => {
        // Play a short wave each time the cat reaches a destination.
        setClipRange(CAT_CLIPS.wave);
        arrivedRef.current = true;
        onSelect(id);
        window.setTimeout(() => {
          // If we have started moving again, don't force-reset the clip.
          if (!walkingRef.current) {
            setClipRange(CAT_CLIPS.idle);
          }
        }, 1200);
      };
      walkingRef.current = true;
    },
    [markers, onSelect],
  );

  // Keep the badge click handler pointed at the latest `choose`.
  useEffect(() => {
    chooseRef.current = choose;
  }, [choose]);

  // When the panel is closed, walk the cat back to the middle and resume spin.
  useEffect(() => {
    if (!ready) return;
    if (selectedId !== null || !arrivedRef.current) return;

    const el = mountRef.current;
    if (!el || !posRef.current) return;

    arrivedRef.current = false;
    const center = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const dy = center.y - posRef.current.y;
    setClipRange(dy >= 0 ? CAT_CLIPS.frontWalk : CAT_CLIPS.backWalk);
    targetRef.current = "center";
    onArriveRef.current = () => {
      setClipRange(CAT_CLIPS.idle);
    };
    walkingRef.current = true;
  }, [selectedId, ready]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      <div
        ref={spriteRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          zIndex: 5,
          pointerEvents: "none",
          willChange: "transform",
        }}
      >
        <div
          style={{
            transform: "translate(-50%, -100%)",
            filter: "drop-shadow(0 8px 10px rgba(60,60,90,0.28))",
          }}
        >
          <SpriteAnimation {...CAT_SHEET} frameRange={clipRange} fps={9} scale={0.34} />
        </div>
      </div>
    </div>
  );
}
