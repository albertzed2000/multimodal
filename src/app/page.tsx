"use client";

import {
  ArrowRight,
  Compass,
  Map,
  RefreshCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Upload,
  X,
  Anchor,
  Star,
} from "lucide-react";
import { useMemo, useState, lazy, Suspense, useEffect } from "react";
import type { PathfinderProfile, ParseStats } from "@/lib/pathfinder";
import type { GlobeMarker } from "@/components/GlobeView";

const GlobeView = lazy(() => import("@/components/GlobeView"));

type AnalyzeResponse = {
  profile: PathfinderProfile;
  profileId?: string;
  stats: ParseStats;
  source: "gemini" | "mock" | "mock-after-error";
  error?: string;
};

type JobProgress = {
  phase: "parsing" | "summarizing" | "synthesizing" | "persisting" | "complete";
  message: string;
  completedChunks: number;
  totalChunks: number;
};

type StartResponse = {
  jobId: string;
  statusUrl: string;
  status: "queued" | "running" | "complete" | "error";
  progress: JobProgress;
  stats: ParseStats;
  error?: string;
};

type StatusResponse = {
  jobId: string;
  status: "queued" | "running" | "complete" | "error";
  progress: JobProgress;
  stats?: ParseStats;
  profileId?: string;
  source?: AnalyzeResponse["source"];
  error?: string;
  details?: string;
};

type SavedProfileResponse = AnalyzeResponse & {
  profileId: string;
  createdAt: string;
};

const storageKey = "pathfinder.profile.v1";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<PathfinderProfile | null>(null);
  const [stats, setStats] = useState<ParseStats | null>(null);
  const [source, setSource] = useState<AnalyzeResponse["source"] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<JobProgress | null>(null);
  const [status, setStatus] = useState<"upload" | "loading" | "world">("upload");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedProfileResponse;
      if (saved?.profile) {
        setProfile(saved.profile);
        setProfileId(saved.profileId ?? null);
        setStats(saved.stats ?? null);
        setSource(saved.source ?? null);
        setStatus("world");
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const fileLabel = useMemo(() => {
    if (!files.length) {
      return "Upload conversations.json or sharded conversations-000.json files";
    }

    return files.length === 1 ? files[0].name : `${files.length} files selected`;
  }, [files]);

  async function analyze() {
    if (!files.length) {
      setError("Select at least one JSON export file.");
      return;
    }

    setError(null);
    setStatus("loading");

    try {
      const payloads = await Promise.all(files.map(readJsonFile));
      const response = await fetch("/api/analyze/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversations: payloads }),
      });
      const data = (await response.json()) as StartResponse;

      if (!response.ok || !data.jobId) {
        throw new Error(data.error ?? "Analysis failed.");
      }

      setStats(data.stats);
      setLoadingProgress(data.progress);
      const saved = await pollAnalysisJob(data.jobId, setLoadingProgress);

      window.localStorage.setItem(storageKey, JSON.stringify(saved));
      setProfile(saved.profile);
      setProfileId(saved.profileId);
      setStats(saved.stats);
      setSource(saved.source);
      setStatus("world");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read export files.");
      setStatus("upload");
    }
  }

  function reset() {
    window.localStorage.removeItem(storageKey);
    setProfile(null);
    setStats(null);
    setSource(null);
    setProfileId(null);
    setLoadingProgress(null);
    setFiles([]);
    setStatus("upload");
    setError(null);
  }

  if (status === "loading") {
    return <LoadingScreen count={files.length} progress={loadingProgress} />;
  }

  if (status === "world" && profile) {
    return (
      <WorldScreen
        profile={profile}
        profileId={profileId}
        stats={stats}
        source={source}
        onReset={reset}
      />
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 md:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between gap-10">
        {/* Nav */}
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#7ecfbf] text-white shadow-md shadow-[#7ecfbf]/30">
              <Compass className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-wide text-[#3d3228]">Pathfinder</span>
          </div>
          <span className="rounded-full border-2 border-[#7ecfbf]/40 bg-white/70 px-3 py-1 text-sm font-medium text-[#7ecfbf]">
            ✨ Local MVP
          </span>
        </nav>

        {/* Hero */}
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[#7ecfbf]/50 bg-[#d4f2ec] px-4 py-1.5 text-sm font-semibold text-[#4a9d8f]">
              <Sparkles className="size-4" />
              Your chat history, turned into cheer
            </p>
            <h1 className="text-5xl font-bold leading-[1.08] text-[#3d3228] md:text-6xl">
              See the good stuff hiding in your conversations.
            </h1>
            <p className="mt-5 text-lg leading-8 text-[#7a6a5a]">
              Upload a ChatGPT export and Pathfinder turns your recurring interests, strengths,
              and next steps into a cozy, uplifting world to explore 🌿
            </p>
          </div>

          <div className="rounded-3xl border-2 border-[#d4f2ec] bg-white/80 p-6 shadow-xl shadow-[#7ecfbf]/10 backdrop-blur">
            <label
              htmlFor="conversation-upload"
              className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#b4ddd4] bg-[#f0faf8] px-5 text-center transition hover:border-[#7ecfbf] hover:bg-[#e8f8f4]"
            >
              <div className="grid size-14 place-items-center rounded-2xl bg-[#7ecfbf] text-white shadow-lg shadow-[#7ecfbf]/30">
                <Upload className="size-7" />
              </div>
              <div>
                <p className="font-bold text-[#3d3228]">{fileLabel}</p>
                <p className="mt-1.5 text-sm text-[#8a9a90]">
                  conversations.json or sharded conversations-###.json
                </p>
              </div>
            </label>
            <input
              id="conversation-upload"
              className="sr-only"
              type="file"
              accept="application/json,.json"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />

            {error ? (
              <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f5c842] px-4 py-3.5 font-bold text-[#3d3228] shadow-md shadow-[#f5c842]/30 transition hover:bg-[#f4b832] disabled:opacity-50"
              onClick={analyze}
              disabled={!files.length}
            >
              Start your journey
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: "1", t: "Parse", d: "We read your user messages from the ChatGPT export." },
            { n: "2", t: "Discover", d: "Interests, strengths & forgotten goals are surfaced." },
            { n: "3", t: "Explore", d: "Your world is built — a cozy map of who you are." },
          ].map(({ n, t, d }) => (
            <div key={n} className="rounded-2xl border-2 border-[#d4f2ec] bg-white/60 px-4 py-3">
              <p className="font-bold text-[#7ecfbf]">{n}. {t}</p>
              <p className="mt-1 text-sm text-[#7a6a5a]">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ count, progress }: { count: number; progress: JobProgress | null }) {
  const totalChunks = progress?.totalChunks ?? 0;
  const completedChunks = progress?.completedChunks ?? 0;
  const percent =
    totalChunks > 0 ? Math.max(8, Math.round((completedChunks / totalChunks) * 100)) : 28;

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="w-full max-w-md rounded-3xl border-2 border-[#d4f2ec] bg-white/85 p-8 text-center shadow-xl shadow-[#7ecfbf]/10 backdrop-blur">
        <div className="mx-auto grid size-16 animate-bounce place-items-center rounded-2xl bg-[#7ecfbf] text-white shadow-lg shadow-[#7ecfbf]/30">
          <Map className="size-8" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#3d3228]">Building your world…</h1>
        <p className="mt-2 text-[#7a6a5a]">
          {progress?.message ??
            `Reading ${count} export file${count === 1 ? "" : "s"} and mapping your interests 🌿`}
        </p>
        {totalChunks > 0 ? (
          <p className="mt-2 font-mono text-xs text-[#a09080]">
            {completedChunks}/{totalChunks} chunks · {progress?.phase}
          </p>
        ) : null}
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#e8f8f4]">
          <div
            className="h-full rounded-full bg-[#7ecfbf] transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-[#b0a090]">{percent}% complete</p>
      </section>
    </main>
  );
}

const ISLAND_COLORS = ["#e9c46a", "#2a9d8f", "#f4a261", "#8ab17d", "#e76f51"];
const ISLAND_EMOJIS = ["🎨", "🧭", "🌿", "✨"];
const ISLAND_POSITIONS: Array<{ lat: number; lng: number }> = [
  { lat: 35, lng: -30 },
  { lat: -20, lng: 60 },
  { lat: 50, lng: 140 },
  { lat: -40, lng: -100 },
];

function buildIslands(profile: PathfinderProfile): GlobeMarker[] {
  const threads = profile.destinyThreads.slice(0, 3);
  const islands: GlobeMarker[] = threads.map((thread, i) => ({
    id: `island-${i}`,
    lat: ISLAND_POSITIONS[i].lat,
    lng: ISLAND_POSITIONS[i].lng,
    label: `Island ${i + 1}`,
    color: ISLAND_COLORS[i],
    emoji: ISLAND_EMOJIS[i],
  }));
  islands.push({
    id: "discovery",
    lat: ISLAND_POSITIONS[3].lat,
    lng: ISLAND_POSITIONS[3].lng,
    label: "Discovery Pond",
    color: ISLAND_COLORS[3],
    emoji: ISLAND_EMOJIS[3],
  });
  return islands;
}

type IslandDetail = {
  marker: GlobeMarker;
  title: string;
  description: string;
  quests: string[];
  strengths: string[];
};

function buildIslandDetail(
  marker: GlobeMarker,
  profile: PathfinderProfile,
  index: number,
): IslandDetail {
  if (marker.id === "discovery") {
    return {
      marker,
      title: "Discovery Pond",
      description:
        "Hidden interests and forgotten sparks float here, waiting to be rediscovered.",
      quests: profile.unfinishedBusiness,
      strengths: profile.reflections.slice(0, 2),
    };
  }
  return {
    marker,
    title: `Island ${index + 1}: ${profile.destinyThreads[index]?.split(" ").slice(0, 4).join(" ") ?? ""}`,
    description: profile.destinyThreads[index] ?? "",
    quests: profile.quests.slice(index * 1, index * 1 + 2),
    strengths: profile.strengths.slice(index, index + 1),
  };
}

function WorldScreen({
  profile,
  profileId,
  stats,
  source,
  onReset,
}: {
  profile: PathfinderProfile;
  profileId: string | null;
  stats: ParseStats | null;
  source: AnalyzeResponse["source"] | null;
  onReset: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completedQuests, setCompletedQuests] = useState<Set<string>>(new Set());

  const islands = useMemo(() => buildIslands(profile), [profile]);

  const selectedIsland = useMemo(() => {
    if (!selectedId) return null;
    const marker = islands.find((m) => m.id === selectedId);
    if (!marker) return null;
    const index = islands.indexOf(marker);
    return buildIslandDetail(marker, profile, index);
  }, [selectedId, islands, profile]);

  function toggleQuest(quest: string) {
    setCompletedQuests((prev) => {
      const next = new Set(prev);
      if (next.has(quest)) next.delete(quest);
      else next.add(quest);
      return next;
    });
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      {/* Top nav */}
      <nav className="flex shrink-0 items-center justify-between border-b-2 border-[#d4f2ec] bg-white/70 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-2xl bg-[#7ecfbf] text-white shadow-md shadow-[#7ecfbf]/25">
            <Compass className="size-4" />
          </div>
          <span className="font-bold text-[#3d3228]">Pathfinder</span>
          <span className="ml-1 rounded-full border-2 border-[#d4f2ec] bg-[#f0faf8] px-2.5 py-0.5 text-xs font-semibold text-[#5aab9b]">
            {profile.archetype}
          </span>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-2xl border-2 border-[#d4f2ec] bg-white px-3 py-1.5 text-sm font-semibold text-[#7a6a5a] transition hover:bg-[#f0faf8]"
          onClick={onReset}
        >
          <RefreshCcw className="size-3.5" />
          Start over
        </button>
      </nav>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r-2 border-[#d4f2ec] bg-white/50 p-5">
          {/* Companion card */}
          <div className="rounded-2xl border-2 border-[#b4ddd4] bg-[#d4f2ec] p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#7ecfbf] text-2xl shadow-md shadow-[#7ecfbf]/30">
                🦊
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#5aab9b]">Companion</p>
                <h2 className="font-bold text-[#3d3228]">{profile.companion.baseType}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#5a6e68]">{profile.summary}</p>
          </div>

          {/* Your Islands */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#a09080]">Your Islands</p>
            <div className="space-y-2">
              {islands.map((island, i) => {
                const isActive = selectedId === island.id;
                const pastelBg: Record<string, string> = {
                  "island-0": "#fff7d6", "island-1": "#d4f2ec",
                  "island-2": "#fde8d8", "discovery": "#dff2d0",
                };
                const pastelBorder: Record<string, string> = {
                  "island-0": "#f5c842", "island-1": "#7ecfbf",
                  "island-2": "#f4a07a", "discovery": "#93c47d",
                };
                const bg = pastelBg[island.id] ?? "#fff";
                const border = pastelBorder[island.id] ?? "#ccc";
                return (
                  <button
                    key={island.id}
                    onClick={() => setSelectedId(island.id === selectedId ? null : island.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition"
                    style={{
                      borderColor: border,
                      background: isActive ? bg : "rgba(255,255,255,0.6)",
                      boxShadow: isActive ? `0 4px 14px ${border}44` : "none",
                    }}
                  >
                    <span className="text-xl">{island.emoji}</span>
                    <p className="text-sm font-semibold" style={{ color: isActive ? "#3d3228" : "#7a6a5a" }}>
                      {island.id === "discovery"
                        ? "Discovery Pond"
                        : profile.destinyThreads[i]?.split(" ").slice(0, 5).join(" ") ?? `Island ${i + 1}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strengths */}
          <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
              <Sparkles className="size-3.5" /> Strengths
            </p>
            <div className="space-y-2">
              {profile.strengths.map((s) => (
                <p key={s} className="text-sm leading-5 text-[#6a5a3a]">{s}</p>
              ))}
            </div>
          </div>

          {stats && (
            <dl className="grid grid-cols-2 gap-2 text-center">
              <Stat label="Messages" value={stats.messages} />
              <Stat label={source === "gemini" ? "Gemini ✓" : "Mock"} value={stats.chunkCount + " chunks"} />
            </dl>
          )}
        </aside>

        {/* Globe center */}
        <div className="relative min-w-0 flex-1">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center">
                <div className="animate-pulse text-[#7ecfbf]">Loading world… 🌿</div>
              </div>
            }
          >
            <GlobeView markers={islands} selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>

          {/* Forgotten projects chip */}
          <button
            onClick={() => setSelectedId(selectedId === "discovery" ? null : "discovery")}
            className="absolute bottom-6 left-6 flex items-center gap-2 rounded-2xl border-2 border-[#93c47d] bg-white/90 px-4 py-2.5 text-sm font-bold text-[#5a8a4a] shadow-lg shadow-[#93c47d]/20 backdrop-blur transition hover:bg-[#dff2d0]"
          >
            <Anchor className="size-4" />
            Forgotten Projects
          </button>

          {!selectedId && (
            <p className="absolute bottom-6 right-6 text-xs font-medium text-[#a09080]">
              Click a marker to explore ✨
            </p>
          )}
        </div>

        {/* Right panel */}
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l-2 border-[#d4f2ec] bg-white/50 p-5">
          {selectedIsland ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#a09080]">
                    {selectedIsland.marker.emoji} Island
                  </p>
                  <h2 className="mt-1 text-xl font-bold leading-tight text-[#3d3228]">
                    {selectedIsland.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl border-2 border-[#e0d8d0] bg-white text-[#a09080] transition hover:bg-[#f0e8e0]"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <p className="text-sm leading-6 text-[#7a6a5a]">{selectedIsland.description}</p>

              {selectedIsland.quests.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#d4805a]">
                    <Swords className="size-3.5" /> Quests
                  </p>
                  <div className="space-y-2">
                    {selectedIsland.quests.map((quest) => (
                      <label
                        key={quest}
                        className="flex cursor-pointer gap-3 rounded-2xl border-2 border-[#fde8d8] bg-[#fff8f4] p-3 transition hover:border-[#f4a07a]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-[#7ecfbf]"
                          checked={completedQuests.has(quest)}
                          onChange={() => toggleQuest(quest)}
                        />
                        <span className="text-sm leading-5 text-[#6a5a4a]">{quest}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedIsland.strengths.length > 0 && (
                <div className="rounded-2xl border-2 border-[#d4f2ec] bg-[#f0faf8] p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5aab9b]">
                    Reflection
                  </p>
                  {selectedIsland.strengths.map((s) => (
                    <p key={s} className="text-sm leading-6 text-[#5a6e68]">{s}</p>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
                  <Star className="size-3.5" /> Companion Rewards
                </p>
                <div className="space-y-1.5">
                  {profile.companion.evolutionItems.map((item) => (
                    <p key={item} className="text-sm leading-5 text-[#7a6a3a]">{item}</p>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#d4805a]">
                  <Swords className="mr-1 inline size-3.5" /> All Quests
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#3d3228]">Small wins to try</h2>
              </div>
              <div className="space-y-2">
                {profile.quests.map((quest, index) => (
                  <label
                    key={quest}
                    className="flex cursor-pointer gap-3 rounded-2xl border-2 border-[#fde8d8] bg-[#fff8f4] p-3 transition hover:border-[#f4a07a]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-[#7ecfbf]"
                      checked={completedQuests.has(quest)}
                      onChange={() => toggleQuest(quest)}
                    />
                    <span>
                      <span className="block text-xs font-bold text-[#c4a060]">Quest {index + 1}</span>
                      <span className="text-sm leading-5 text-[#6a5a4a]">{quest}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
                  <Trophy className="size-3.5" /> Destiny Threads
                </p>
                {profile.destinyThreads.map((t) => (
                  <p key={t} className="mb-2 text-sm leading-5 text-[#7a6a3a]">{t}</p>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border-2 border-[#d4f2ec] bg-white/70 p-3">
      <dt className="text-xs font-semibold text-[#a09080]">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-bold text-[#3d3228]">{value}</dd>
    </div>
  );
}

function MapNode({ index, text }: { index: number; text: string }) {
  const colors = ["#e9c46a", "#2a9d8f", "#e76f51", "#8ab17d", "#f4a261"];
  return (
    <article className="rounded-md border border-white/12 bg-black/35 p-4 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3">
        <span
          className="grid size-9 place-items-center rounded-full font-mono text-sm text-black"
          style={{ backgroundColor: colors[index % colors.length] }}
        >
          {index + 1}
        </span>
        <h3 className="font-semibold">Highlight</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/66">{text}</p>
    </article>
  );
}

function Panel({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <section className="rounded-md border border-white/10 bg-black/25 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-white/88">
        {icon}
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-white/62">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

async function readJsonFile(file: File) {
  const text = await file.text();
  return JSON.parse(text);
}

async function pollAnalysisJob(
  jobId: string,
  onProgress: (progress: JobProgress) => void,
): Promise<SavedProfileResponse> {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await wait(1200);
    const statusResponse = await fetch(`/api/analyze/status/${jobId}`);
    const job = (await statusResponse.json()) as StatusResponse;

    if (!statusResponse.ok) {
      throw new Error(job.error ?? "Could not read analysis status.");
    }

    onProgress(job.progress);

    if (job.status === "error") {
      throw new Error(job.details ?? job.error ?? "Analysis job failed.");
    }

    if (job.status === "complete" && job.profileId) {
      const profileResponse = await fetch(`/api/profile/${job.profileId}`);
      const saved = (await profileResponse.json()) as SavedProfileResponse;
      if (!profileResponse.ok) {
        throw new Error(saved.error ?? "Could not load saved profile.");
      }
      return saved;
    }
  }

  throw new Error("Analysis timed out.");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
