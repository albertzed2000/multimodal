import { NextRequest, NextResponse } from "next/server";
import { analyzePathfinderProfile } from "@/lib/pathfinder-analyzer";
import {
  buildConversationChunks,
  buildParseStats,
  extractUserMessages,
  normalizeConversationPayload,
} from "@/lib/pathfinder";
import { createJob, saveProfile, updateJob } from "@/lib/pathfinder-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const conversations = normalizeConversationPayload(body.conversations ?? body);
    const messages = extractUserMessages(conversations);
    const chunks = buildConversationChunks(messages);
    const stats = buildParseStats(conversations.length, messages, chunks);

    if (!messages.length) {
      return NextResponse.json(
        { error: "No user messages found in the uploaded export." },
        { status: 400 },
      );
    }

    const job = await createJob(stats);

    void runJob({
      jobId: job.jobId,
      messages,
      chunks,
      stats,
    });

    return NextResponse.json(
      {
        jobId: job.jobId,
        statusUrl: `/api/analyze/status/${job.jobId}`,
        status: job.status,
        progress: job.progress,
        stats,
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown analysis start error.",
      },
      { status: 500 },
    );
  }
}

async function runJob({
  jobId,
  messages,
  chunks,
  stats,
}: {
  jobId: string;
  messages: ReturnType<typeof extractUserMessages>;
  chunks: ReturnType<typeof buildConversationChunks>;
  stats: ReturnType<typeof buildParseStats>;
}) {
  try {
    await updateJob(jobId, {
      status: "running",
      stats,
      progress: {
        phase: "summarizing",
        message: `Starting analysis across ${chunks.length} chunks.`,
        completedChunks: 0,
        totalChunks: chunks.length,
      },
    });

    const result = await analyzePathfinderProfile({
      messages,
      chunks,
      onProgress: async (progress) => {
        await updateJob(jobId, {
          status: progress.phase === "complete" ? "complete" : "running",
          progress,
        });
      },
    });

    await updateJob(jobId, {
      status: "running",
      source: result.source,
      progress: {
        phase: "persisting",
        message: "Saving profile locally.",
        completedChunks: chunks.length,
        totalChunks: chunks.length,
      },
    });

    const saved = await saveProfile({
      profile: result.profile,
      stats,
      source: result.source,
    });

    await updateJob(jobId, {
      status: "complete",
      profileId: saved.profileId,
      source: result.source,
      progress: {
        phase: "complete",
        message: "Profile saved and ready.",
        completedChunks: chunks.length,
        totalChunks: chunks.length,
      },
    });
  } catch (error) {
    await updateJob(jobId, {
      status: "error",
      error: "Analysis job failed.",
      details: error instanceof Error ? error.message : "Unknown analysis job error.",
    });
  }
}
