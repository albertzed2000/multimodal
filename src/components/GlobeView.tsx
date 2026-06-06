"use client";

import { useEffect, useRef, useState } from "react";

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
  const colors: Record<string, { bg: string; border: string; shadow: string }> = {
    "island-0": { bg: "#fff7d6", border: "#f5c842", shadow: "#f5c84255" },
    "island-1": { bg: "#d4f2ec", border: "#7ecfbf", shadow: "#7ecfbf55" },
    "island-2": { bg: "#fde8d8", border: "#f4a07a", shadow: "#f4a07a55" },
    "discovery": { bg: "#dff2d0", border: "#93c47d", shadow: "#93c47d55" },
  };
  const p = colors[marker.id] ?? colors["island-0"];

  const wrap = document.createElement("div");
  wrap.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;user-select:none;`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `
    width: 58px; height: 58px; border-radius: 50%;
    background: ${p.bg};
    border: 3px solid ${p.border};
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    box-shadow: 0 4px 18px ${p.shadow}, 0 2px 6px rgba(0,0,0,0.08);
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
  `;
  bubble.textContent = marker.emoji;

  const tag = document.createElement("div");
  tag.style.cssText = `
    background: white; border: 2.5px solid ${p.border}; border-radius: 20px;
    padding: 3px 11px; font-size: 10.5px; font-weight: 700; color: #4a3f35;
    white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    letter-spacing: 0.03em; font-family: system-ui, sans-serif;
  `;
  tag.textContent = marker.label;

  wrap.appendChild(bubble);
  wrap.appendChild(tag);

  wrap.addEventListener("click", () => {
    wrap.dispatchEvent(new CustomEvent("markerclick", { detail: marker.id, bubbles: true }));
    void onClickId;
  });
  wrap.addEventListener("mouseenter", () => {
    bubble.style.transform = "scale(1.2) translateY(-4px)";
    bubble.style.boxShadow = `0 10px 28px ${p.shadow}, 0 2px 6px rgba(0,0,0,0.10)`;
  });
  wrap.addEventListener("mouseleave", () => {
    bubble.style.transform = "scale(1)";
    bubble.style.boxShadow = `0 4px 18px ${p.shadow}, 0 2px 6px rgba(0,0,0,0.08)`;
  });

  return wrap;
}

export default function GlobeView({ markers, selectedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mountRef.current || globeRef.current) return;
    let cancelled = false;
    let animFrame: number;

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
        .htmlElement((d: unknown) => makeBadge(d as GlobeMarker, onSelect))
        .htmlLat((d: unknown) => (d as GlobeMarker).lat)
        .htmlLng((d: unknown) => (d as GlobeMarker).lng)
        .htmlAltitude(0.04)
        .pointOfView({ lat: 18, lng: 0, altitude: 2.2 }, 0);

      // Warm pastel lighting
      const scene = instance.scene();
      scene.children
        .filter((c: { type: string }) => ["AmbientLight", "DirectionalLight"].includes(c.type))
        .forEach((l: { intensity: number }) => { l.intensity = 0; });
      scene.add(new THREE.AmbientLight(0xfff8f0, 1.6));
      const sun = new THREE.DirectionalLight(0xffeedd, 0.9);
      sun.position.set(4, 3, 2);
      scene.add(sun);

      // Gentle auto-rotate
      let lng = 0;
      const go = () => {
        lng += 0.07;
        instance.pointOfView({ lat: 18, lng, altitude: 2.2 }, 0);
        animFrame = requestAnimationFrame(go);
      };
      animFrame = requestAnimationFrame(go);

      globeRef.current = { instance, stopRotate: () => cancelAnimationFrame(animFrame) };
      setReady(true);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrame!);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bubble clicks
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const h = (e: Event) => onSelect((e as CustomEvent).detail as string);
    el.addEventListener("markerclick", h);
    return () => el.removeEventListener("markerclick", h);
  }, [onSelect]);

  // Fly to selected
  useEffect(() => {
    if (!ready || !globeRef.current) return;
    const m = markers.find((m) => m.id === selectedId);
    if (m) globeRef.current.instance.pointOfView({ lat: m.lat, lng: m.lng, altitude: 1.7 }, 900);
  }, [selectedId, ready, markers]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
