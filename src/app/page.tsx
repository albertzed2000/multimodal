"use client";

import {
  ArrowRight,
  Compass,
  Map,
  RefreshCcw,
  Sparkles,
  Swords,
  Trophy,
  Upload,
  X,
  Star,
} from "lucide-react";
import { useMemo, useState, lazy, Suspense, useEffect } from "react";
import {
  buildFallbackWorld,
  type PathfinderDestination,
  type PathfinderProfile,
  type PathfinderTask,
  type ParseStats,
} from "@/lib/pathfinder";
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
        window.setTimeout(() => {
          setProfile(saved.profile);
          setProfileId(saved.profileId ?? null);
          setStats(saved.stats ?? null);
          setSource(saved.source ?? null);
          setStatus("world");
        }, 0);
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
        key={profileId ?? "local-profile"}
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
// All four islands sit on the front-facing hemisphere (camera looks at lat 18,
// lng 0) so they stay visible on the stationary globe and the cat can walk
// between any of them without targets falling off-screen.
const ISLAND_POSITIONS: Array<{ lat: number; lng: number }> = [
  { lat: 48, lng: -18 },
  { lat: -14, lng: 9 },
  { lat: 6, lng: 40 },
  { lat: -22, lng: -28 },
];

function buildIslands(profile: PathfinderProfile): GlobeMarker[] {
  const world = profile.world ?? buildFallbackWorld(profile);
  return world.destinations.slice(0, 4).map((destination, i) => ({
    id: destination.id,
    lat: ISLAND_POSITIONS[i].lat,
    lng: ISLAND_POSITIONS[i].lng,
    label: destination.title,
    color: ISLAND_COLORS[i],
    emoji: destination.emoji || emojiForInterest(destination.iconHint),
  }));
}

type IslandDetail = {
  marker: GlobeMarker;
  destination: PathfinderDestination;
};

function buildIslandDetail(
  marker: GlobeMarker,
  profile: PathfinderProfile,
): IslandDetail {
  const world = profile.world ?? buildFallbackWorld(profile);
  const destination =
    world.destinations.find((item) => item.id === marker.id) ??
    world.destinations[0];
  return {
    marker,
    destination,
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
  const [currentProfile, setCurrentProfile] = useState<PathfinderProfile>(() => ensureProfileWorld(profile));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const world = currentProfile.world ?? buildFallbackWorld(currentProfile);
  const mainTasks = world.mainTasks;
  const completedTasks = world.completedTasks;
  const islands = useMemo(() => buildIslands(currentProfile), [currentProfile]);

  const selectedIsland = useMemo(() => {
    if (!selectedId) return null;
    const marker = islands.find((m) => m.id === selectedId);
    if (!marker) return null;
    return buildIslandDetail(marker, currentProfile);
  }, [selectedId, islands, currentProfile]);

  async function applySavedProfile(saved: SavedProfileResponse) {
    setCurrentProfile(ensureProfileWorld(saved.profile));
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }

  function applyLocalProfile(next: PathfinderProfile) {
    const withWorld = ensureProfileWorld(next);
    setCurrentProfile(withWorld);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        profileId,
        profile: withWorld,
        stats,
        source,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async function addTask(task: PathfinderTask) {
    setBusyTaskId(task.id);
    setTaskError(null);
    try {
      if (profileId) {
        const saved = await patchTask(profileId, { action: "add", task });
        await applySavedProfile(saved);
      } else {
        applyLocalProfile({
          ...currentProfile,
          world: { ...world, mainTasks: dedupeTasks([...mainTasks, task]) },
        });
      }
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Could not add task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function dismissTask(destinationId: string, task: PathfinderTask) {
    setBusyTaskId(task.id);
    setTaskError(null);
    try {
      if (profileId) {
        let saved = await patchTask(profileId, { action: "dismiss", destinationId, task });
        let destination = saved.profile.world?.destinations.find((item) => item.id === destinationId);
        if (destination && destination.suggestedTasks.length < 3) {
          saved = await generateTasks(profileId, destinationId);
          destination = saved.profile.world?.destinations.find((item) => item.id === destinationId);
          if (destination && destination.suggestedTasks.length < 3) {
            saved = await patchTask(profileId, { action: "dismiss", destinationId, task });
          }
        }
        await applySavedProfile(saved);
      } else {
        const destinations = world.destinations.map((destination) => {
          if (destination.id !== destinationId) return destination;
          const [replacement, ...backupTasks] = destination.backupTasks;
          const suggestedTasks = destination.suggestedTasks.filter((item) => item.id !== task.id);
          return {
            ...destination,
            suggestedTasks: replacement
              ? dedupeTasks([...suggestedTasks, replacement]).slice(0, 3)
              : suggestedTasks,
            backupTasks,
          };
        });
        applyLocalProfile({ ...currentProfile, world: { ...world, destinations } });
      }
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Could not replace task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function completeTask(task: PathfinderTask) {
    setBusyTaskId(task.id);
    setTaskError(null);
    try {
      if (profileId) {
        const saved = await patchTask(profileId, { action: "complete", task });
        await applySavedProfile(saved);
      } else {
        applyLocalProfile({
          ...currentProfile,
          summary: `${currentProfile.summary} You completed "${task.title}", adding new momentum.`,
          world: {
            ...world,
            mainTasks: mainTasks.filter((item) => item.id !== task.id),
            completedTasks: dedupeTasks([...completedTasks, task]),
            completionNotes: [
              ...world.completionNotes,
              `Completed "${task.title}" and gained ${task.companionReward}`,
            ],
          },
        });
      }
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Could not complete task.");
    } finally {
      setBusyTaskId(null);
    }
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
            {currentProfile.archetype}
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
                <h2 className="font-bold text-[#3d3228]">{currentProfile.companion.baseType}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#5a6e68]">{currentProfile.summary}</p>
          </div>

          <div className="rounded-2xl border-2 border-[#fde8d8] bg-[#fff8f4] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#d4805a]">
              <Swords className="size-3.5" /> Main Task List
            </p>
            <div className="space-y-2">
              {mainTasks.length ? (
                mainTasks.map((task) => (
                  <button
                    key={task.id}
                    className="flex w-full gap-2 rounded-xl border-2 border-[#fde8d8] bg-white/75 p-2 text-left text-sm leading-5 text-[#6a5a4a] transition hover:border-[#f4a07a] disabled:opacity-60"
                    onClick={() => completeTask(task)}
                    disabled={busyTaskId === task.id}
                    title="Complete task"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-[#7ecfbf] text-[10px] font-bold text-[#7ecfbf]">
                      ✓
                    </span>
                    <span>
                      <span className="block font-semibold text-[#3d3228]">{task.title}</span>
                      <span className="line-clamp-2">{task.description}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm leading-5 text-[#7a6a5a]">
                  Add tasks from any destination with the + button.
                </p>
              )}
            </div>
          </div>

          {/* Strengths */}
          <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
              <Sparkles className="size-3.5" /> Strengths
            </p>
            <div className="space-y-2">
              {currentProfile.strengths.map((s) => (
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
              {selectedIsland.marker.emoji} Destination
                  </p>
                  <h2 className="mt-1 text-xl font-bold leading-tight text-[#3d3228]">
                    {selectedIsland.destination.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl border-2 border-[#e0d8d0] bg-white text-[#a09080] transition hover:bg-[#f0e8e0]"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="rounded-2xl border-2 border-[#d4f2ec] bg-[#f0faf8] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5aab9b]">
                  Observation
                </p>
                <p className="text-sm leading-6 text-[#5a6e68]">
                  {selectedIsland.destination.observation}
                </p>
              </div>

              {selectedIsland.destination.suggestedTasks.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#d4805a]">
                    <Swords className="size-3.5" /> Suggested tasks and projects
                  </p>
                  <div className="space-y-2">
                    {selectedIsland.destination.suggestedTasks.slice(0, 3).map((task) => (
                      <TaskSuggestionCard
                        key={task.id}
                        task={task}
                        busy={busyTaskId === task.id}
                        onAdd={() => addTask(task)}
                        onDismiss={() => dismissTask(selectedIsland.destination.id, task)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {taskError ? (
                <p className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {taskError}
                </p>
              ) : null}

              <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
                  <Star className="size-3.5" /> Companion Rewards
                </p>
                <div className="space-y-1.5">
                  {currentProfile.companion.evolutionItems.map((item) => (
                    <p key={item} className="text-sm leading-5 text-[#7a6a3a]">{item}</p>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#d4805a]">
                  <Swords className="mr-1 inline size-3.5" /> Main Task List
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#3d3228]">Accepted tasks</h2>
              </div>
              <div className="space-y-2">
                {mainTasks.length ? (
                  mainTasks.map((task) => (
                    <TaskTodoCard
                      key={task.id}
                      task={task}
                      busy={busyTaskId === task.id}
                      onComplete={() => completeTask(task)}
                    />
                  ))
                ) : (
                  <p className="rounded-2xl border-2 border-[#d4f2ec] bg-white/70 p-4 text-sm leading-6 text-[#7a6a5a]">
                    Click a destination, then use + to add suggested tasks here.
                  </p>
                )}
              </div>

              {completedTasks.length > 0 ? (
                <div className="rounded-2xl border-2 border-[#d4f2ec] bg-[#f0faf8] p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5aab9b]">
                    Completed
                  </p>
                  {completedTasks.slice(-3).map((task) => (
                    <p key={task.id} className="mb-2 text-sm leading-5 text-[#5a6e68]">
                      ✓ {task.title}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border-2 border-[#fef6cc] bg-[#fffdf0] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#c4a020]">
                  <Trophy className="size-3.5" /> Destiny Threads
                </p>
                {currentProfile.destinyThreads.map((t) => (
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

function TaskSuggestionCard({
  task,
  busy,
  onAdd,
  onDismiss,
}: {
  task: PathfinderTask;
  busy: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="rounded-2xl border-2 border-[#fde8d8] bg-[#fff8f4] p-3 transition hover:border-[#f4a07a]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c4a060]">
            {task.category}
          </p>
          <h3 className="mt-1 text-sm font-bold text-[#3d3228]">{task.title}</h3>
          <p className="mt-1 text-sm leading-5 text-[#6a5a4a]">{task.description}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            className="grid size-8 place-items-center rounded-xl bg-[#7ecfbf] text-white transition hover:bg-[#63b8a9] disabled:opacity-50"
            onClick={onAdd}
            disabled={busy}
            title="Add to main task list"
          >
            +
          </button>
          <button
            className="grid size-8 place-items-center rounded-xl border-2 border-[#e0d8d0] bg-white text-[#a09080] transition hover:bg-[#f0e8e0] disabled:opacity-50"
            onClick={onDismiss}
            disabled={busy}
            title="Replace this suggestion"
          >
            ×
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#b08a70]">{task.companionReward}</p>
    </article>
  );
}

function TaskTodoCard({
  task,
  busy,
  onComplete,
}: {
  task: PathfinderTask;
  busy: boolean;
  onComplete: () => void;
}) {
  return (
    <article className="rounded-2xl border-2 border-[#fde8d8] bg-[#fff8f4] p-3">
      <div className="flex gap-3">
        <button
          type="button"
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-[#7ecfbf] bg-white text-xs font-bold text-[#7ecfbf] transition hover:bg-[#d4f2ec] disabled:opacity-50"
          onClick={onComplete}
          disabled={busy}
          title="Complete task"
        >
          ✓
        </button>
        <span>
          <span className="block text-xs font-bold text-[#c4a060]">{task.category}</span>
          <span className="block text-sm font-semibold leading-5 text-[#3d3228]">{task.title}</span>
          <span className="mt-1 block text-sm leading-5 text-[#6a5a4a]">{task.description}</span>
        </span>
      </div>
    </article>
  );
}

async function readJsonFile(file: File) {
  const text = await file.text();
  return JSON.parse(text);
}

async function patchTask(
  profileId: string,
  body: {
    action: "add" | "dismiss" | "complete";
    destinationId?: string;
    task: PathfinderTask;
  },
) {
  const response = await fetch(`/api/profile/${profileId}/tasks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const saved = (await response.json()) as SavedProfileResponse;
  if (!response.ok) {
    throw new Error(saved.error ?? "Task update failed.");
  }
  return saved;
}

async function generateTasks(profileId: string, destinationId: string) {
  const response = await fetch(`/api/profile/${profileId}/tasks/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationId, count: 5 }),
  });
  const saved = (await response.json()) as SavedProfileResponse;
  if (!response.ok) {
    throw new Error(saved.error ?? "Task generation failed.");
  }
  return saved;
}

function ensureProfileWorld(profile: PathfinderProfile): PathfinderProfile {
  return {
    ...profile,
    world: profile.world ?? buildFallbackWorld(profile),
  };
}

function dedupeTasks(tasks: PathfinderTask[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = task.id || task.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emojiForInterest(value: string) {
  const lower = value.toLowerCase();
  if (/code|engineer|developer|software|api|backend|tool/.test(lower)) return "🛠️";
  if (/design|art|creative|visual|brand/.test(lower)) return "🎨";
  if (/ai|model|agent|automation|chat/.test(lower)) return "✨";
  if (/health|fitness|body|habit/.test(lower)) return "🌱";
  if (/career|startup|founder|business|product/.test(lower)) return "🚀";
  if (/writing|story|content|journal/.test(lower)) return "✍️";
  if (/learn|research|study|knowledge/.test(lower)) return "📚";
  return "🧭";
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
