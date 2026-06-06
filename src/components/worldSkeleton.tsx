import { useState } from "react";

/**
 * Static placeholder destinations.
 * Each destination has an id, title, position (x/y in percent relative to the world),
 * and an emoji/icon for now. You can replace these later with real data.
 */
const placeholderDestinations = [
  { id: "art", title: "Interest 1", x: 20, y: 30, icon: "🎨", description: "Placeholder description for interest 1." },
  { id: "career", title: "Interest 2", x: 65, y: 25, icon: "💼", description: "Placeholder description for interest 2." },
  { id: "fitness", title: "Interest 3", x: 70, y: 65, icon: "🌿", description: "Placeholder description for interest 3." },
  { id: "misc", title: "Discovery Pond", x: 35, y: 75, icon: "✨", description: "Miscellaneous and forgotten projects." },
];

/**
 * A bare‐bones world map with clickable markers and a floating info panel.
 * No external libraries are required; Tailwind CSS is used for styling.
 */
export default function WorldSkeleton() {
  const [selected, setSelected] = useState(placeholderDestinations[0]);

  return (
    <div className="relative mx-auto h-[500px] w-full max-w-md">
      {/* World circle */}
      <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-b from-blue-200 via-blue-100 to-indigo-200">
        {/* Markers */}
        {placeholderDestinations.map((dest) => (
          <button
            key={dest.id}
            className="absolute grid size-12 place-items-center rounded-full border-4 border-white bg-yellow-200 shadow-lg transition hover:scale-105"
            style={{
              left: `${dest.x}%`,
              top: `${dest.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => setSelected(dest)}
          >
            <span className="text-2xl">{dest.icon}</span>
          </button>
        ))}

        {/* Info panel */}
        {selected && (
          <div className="absolute right-0 top-1/2 w-[260px] -translate-y-1/2 rounded-2xl border border-gray-300 bg-white/90 p-4 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <p className="mt-2 text-sm text-gray-700">{selected.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}