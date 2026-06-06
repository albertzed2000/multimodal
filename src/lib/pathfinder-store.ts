import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AnalysisSource, AnalyzeProgress } from "@/lib/pathfinder-analyzer";
import { PathfinderProfile, ParseStats } from "@/lib/pathfinder";

export type JobStatus = "queued" | "running" | "complete" | "error";

export type AnalysisJob = {
  jobId: string;
  status: JobStatus;
  progress: AnalyzeProgress;
  stats?: ParseStats;
  profileId?: string;
  source?: AnalysisSource;
  error?: string;
  details?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedProfile = {
  profileId: string;
  profile: PathfinderProfile;
  stats: ParseStats;
  source: AnalysisSource;
  createdAt: string;
};

const storeRoot = path.join(process.cwd(), ".pathfinder");
const jobsDir = path.join(storeRoot, "jobs");
const profilesDir = path.join(storeRoot, "profiles");

export async function createJob(stats?: ParseStats) {
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    jobId: randomUUID(),
    status: "queued",
    stats,
    progress: {
      phase: "parsing",
      message: "Queued analysis job.",
      completedChunks: 0,
      totalChunks: stats?.chunkCount ?? 0,
    },
    createdAt: now,
    updatedAt: now,
  };
  await writeJob(job);
  return job;
}

export async function readJob(jobId: string) {
  const job = await readJson<AnalysisJob>(path.join(jobsDir, `${jobId}.json`));
  return job;
}

export async function updateJob(jobId: string, patch: Partial<AnalysisJob>) {
  const existing = await readJob(jobId);
  const job: AnalysisJob = {
    ...existing,
    ...patch,
    progress: patch.progress ?? existing.progress,
    updatedAt: new Date().toISOString(),
  };
  await writeJob(job);
  return job;
}

export async function saveProfile({
  profile,
  stats,
  source,
}: {
  profile: PathfinderProfile;
  stats: ParseStats;
  source: AnalysisSource;
}) {
  const saved: SavedProfile = {
    profileId: randomUUID(),
    profile,
    stats,
    source,
    createdAt: new Date().toISOString(),
  };
  await ensureDir(profilesDir);
  await writeFile(profilePath(saved.profileId), JSON.stringify(saved, null, 2));
  return saved;
}

export async function readProfile(profileId: string) {
  return readJson<SavedProfile>(profilePath(profileId));
}

export async function writeProfile(saved: SavedProfile) {
  await ensureDir(profilesDir);
  await writeFile(profilePath(saved.profileId), JSON.stringify(saved, null, 2));
  return saved;
}

export async function updateProfile(
  profileId: string,
  updater: (saved: SavedProfile) => SavedProfile | Promise<SavedProfile>,
) {
  const current = await readProfile(profileId);
  const next = await updater(current);
  return writeProfile(next);
}

async function writeJob(job: AnalysisJob) {
  await ensureDir(jobsDir);
  await writeFile(jobPath(job.jobId), JSON.stringify(job, null, 2));
}

function jobPath(jobId: string) {
  return path.join(jobsDir, `${jobId}.json`);
}

function profilePath(profileId: string) {
  return path.join(profilesDir, `${profileId}.json`);
}

async function readJson<T>(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}
