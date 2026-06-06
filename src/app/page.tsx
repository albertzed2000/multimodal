"use client";

import {
  ArrowRight,
  Compass,
  FileJson,
  Map,
  RefreshCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PathfinderProfile, ParseStats } from "@/lib/pathfinder";

type AnalyzeResponse = {
  profile: PathfinderProfile;
  stats: ParseStats;
  source: "gemini" | "mock" | "mock-after-error";
  error?: string;
};

const storageKey = "pathfinder.profile.v1";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<PathfinderProfile | null>(null);
  const [stats, setStats] = useState<ParseStats | null>(null);
  const [source, setSource] = useState<AnalyzeResponse["source"] | null>(null);
  const [status, setStatus] = useState<"upload" | "loading" | "world">("upload");
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversations: payloads }),
      });
      const data = (await response.json()) as AnalyzeResponse;

      if (!response.ok && !data.profile) {
        throw new Error(data.error ?? "Analysis failed.");
      }

      window.localStorage.setItem(storageKey, JSON.stringify(data));
      setProfile(data.profile);
      setStats(data.stats);
      setSource(data.source);
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
    setFiles([]);
    setStatus("upload");
    setError(null);
  }

  if (status === "loading") {
    return <LoadingScreen count={files.length} />;
  }

  if (status === "world" && profile) {
    return <WorldScreen profile={profile} stats={stats} source={source} onReset={reset} />;
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-between gap-10">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-white/15 bg-white/10">
              <Compass className="size-5 text-[#e9c46a]" />
            </div>
            <span className="text-lg font-semibold tracking-wide">Pathfinder</span>
          </div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/70">
            Local MVP
          </span>
        </nav>

        <div className="grid items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2a9d8f]/40 bg-[#2a9d8f]/12 px-3 py-1 text-sm text-[#9be3d9]">
              <Sparkles className="size-4" />
              Your chat history, turned into cheer
            </p>
            <h1 className="text-5xl font-semibold leading-[1.02] md:text-7xl">
              See the good stuff hiding in your conversations.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              Upload a ChatGPT export and Pathfinder turns your recurring interests, strengths,
              and next steps into a cute, uplifting dashboard with a companion and small wins to
              chase.
            </p>
          </div>

          <div className="rounded-lg border border-white/12 bg-black/28 p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <label
              htmlFor="conversation-upload"
              className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-md border border-dashed border-white/20 bg-white/[0.04] px-5 text-center transition hover:border-[#e9c46a]/70 hover:bg-white/[0.07]"
            >
              <div className="grid size-14 place-items-center rounded-lg bg-[#e9c46a] text-black">
                <Upload className="size-7" />
              </div>
              <div>
                <p className="font-medium">{fileLabel}</p>
                <p className="mt-2 text-sm text-white/52">
                  Works with one export file or multiple `conversations-###.json` shards.
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
              <p className="mt-4 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#f4a261] px-4 py-3 font-semibold text-black transition hover:bg-[#e9c46a]"
              onClick={analyze}
              disabled={!files.length}
            >
              Generate Dashboard
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-white/55 md:grid-cols-3">
          <p>1. Parse user-authored messages from ChatGPT mappings.</p>
          <p>2. Compress large exports into representative analysis chunks.</p>
          <p>3. Render an encouraging profile with companion, sparkles, and quests.</p>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ count }: { count: number }) {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="w-full max-w-xl rounded-lg border border-white/12 bg-black/35 p-8 text-center">
        <div className="mx-auto grid size-16 animate-pulse place-items-center rounded-lg bg-[#2a9d8f] text-black">
          <Map className="size-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Building your dashboard</h1>
        <p className="mt-3 text-white/62">
          Reading {count} export file{count === 1 ? "" : "s"}, finding your highlights, and lining
          up a few cheerful next steps.
        </p>
        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-[#e9c46a]" />
        </div>
      </section>
    </main>
  );
}

function WorldScreen({
  profile,
  stats,
  source,
  onReset,
}: {
  profile: PathfinderProfile;
  stats: ParseStats | null;
  source: AnalyzeResponse["source"] | null;
  onReset: () => void;
}) {
  return (
    <main className="min-h-screen px-5 py-6 md:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[320px_1fr_360px]">
        <aside className="rounded-lg border border-white/12 bg-black/30 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[#e9c46a]">Archetype</p>
              <h1 className="mt-2 text-3xl font-semibold">{profile.archetype}</h1>
            </div>
            <button
              className="grid size-10 place-items-center rounded-md border border-white/12 bg-white/5"
              onClick={onReset}
              title="Start over"
            >
              <RefreshCcw className="size-4" />
            </button>
          </div>
          <p className="mt-5 leading-7 text-white/66">{profile.summary}</p>

          <div className="mt-6 rounded-md border border-[#2a9d8f]/35 bg-[#2a9d8f]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-md bg-[#2a9d8f] text-black">
                <Shield className="size-6" />
              </div>
              <div>
                <p className="text-sm text-white/54">Companion</p>
                <h2 className="font-semibold">{profile.companion.baseType}</h2>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {profile.companion.evolutionItems.map((item) => (
                <p key={item} className="rounded-md bg-black/20 px-3 py-2 text-sm text-white/68">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Messages" value={stats?.messages ?? 0} />
            <Stat label="Chunks" value={stats?.chunkCount ?? 0} />
            <Stat label="Mode" value={source === "gemini" ? "Gemini" : "Mock"} />
          </dl>
        </aside>

        <section className="min-h-[720px] rounded-lg border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-white/48">Sparkle Board</p>
              <h2 className="mt-1 text-2xl font-semibold">Things worth celebrating</h2>
            </div>
            <div className="rounded-full border border-white/12 px-3 py-1 text-sm text-white/58">
              {profile.reflections.length} highlights
            </div>
          </div>

          <div className="relative mt-6 min-h-[610px] overflow-hidden rounded-md border border-white/10 bg-[#10141a]">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="relative grid gap-5 p-5 md:grid-cols-2">
              {profile.reflections.map((reflection, index) => (
                <MapNode key={reflection} index={index} text={reflection} />
              ))}
              <Panel title="Your Strengths" icon={<Sparkles className="size-4" />} items={profile.strengths} />
              <Panel title="Destiny Threads" icon={<Trophy className="size-4" />} items={profile.destinyThreads} />
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-white/12 bg-black/30 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#e76f51] text-black">
              <Swords className="size-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[#f4a261]">Quest Panel</p>
              <h2 className="text-xl font-semibold">Small wins to try</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {profile.quests.map((quest, index) => (
              <label
                key={quest}
                className="flex gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 transition hover:border-[#e9c46a]/45"
              >
                <input className="mt-1 size-4 accent-[#2a9d8f]" type="checkbox" />
                <span>
                  <span className="block font-medium">Quest {index + 1}</span>
                  <span className="mt-1 block text-sm leading-6 text-white/62">{quest}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5">
            <Panel title="Gentle Nudges" icon={<FileJson className="size-4" />} items={profile.unfinishedBusiness} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <dt className="text-xs text-white/45">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
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
