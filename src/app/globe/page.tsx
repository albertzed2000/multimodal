"use client";

import { lazy, Suspense, useState } from "react";
import type { GlobeMarker } from "@/components/GlobeView";

const GlobeView = lazy(() => import("@/components/GlobeView"));

// All four nodes sit on the front-facing hemisphere (camera looks at lat 18,
// lng 0) so they stay visible on the stationary globe and the cat can walk
// between them without anything popping in/out of view. Positions are
// deliberately scattered (varied lat/lng) rather than laid out on a grid.
const ISLANDS: GlobeMarker[] = [
  { id: "island-0", lat: 48, lng: -18, label: "Build tools", color: "#e9c46a", emoji: "🎨" },
  { id: "island-2", lat: 6, lng: 40, label: "AI & creativity", color: "#f4a261", emoji: "🌿" },
  { id: "discovery", lat: 10, lng: -28, label: "Discovery Pond", color: "#8ab17d", emoji: "✨" },
  { id: "island-1", lat: -14, lng: 9, label: "Reflection systems", color: "#2a9d8f", emoji: "🧭" },
];

export default function GlobePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ISLANDS.find((m) => m.id === selectedId);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "radial-gradient(ellipse at 15% 0%, #d8f4ef, transparent 50%), radial-gradient(ellipse at 85% 5%, #f8e4f0, transparent 45%), radial-gradient(ellipse at 50% 100%, #fef0d8, transparent 55%), #f0ece4", position: "relative" }}>
      <Suspense fallback={<div style={{ color: "white", padding: 40 }}>Loading globe…</div>}>
        <GlobeView markers={ISLANDS} selectedId={selectedId} onSelect={setSelectedId} />
      </Suspense>

      {selected && (
        <div style={{
          position: "absolute", top: 24, right: 24,
          background: "rgba(255,255,255,0.88)", border: `2px solid ${selected.color}`,
          borderRadius: 20, padding: "16px 20px", color: "#3a3a3a", backdropFilter: "blur(12px)",
          minWidth: 200, boxShadow: `0 8px 32px ${selected.color}44`,
          fontFamily: "system-ui, sans-serif",
        }}>
          <p style={{ fontSize: 28, margin: 0 }}>{selected.emoji}</p>
          <p style={{ color: selected.color, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", margin: "8px 0 4px", fontWeight: 700 }}>Island</p>
          <h2 style={{ margin: 0, fontSize: 18, color: "#2a2a2a" }}>{selected.label}</h2>
          <button onClick={() => setSelectedId(null)} style={{ marginTop: 12, background: selected.color, border: "none", color: "white", borderRadius: 20, padding: "6px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            Close
          </button>
        </div>
      )}

    </div>
  );
}
