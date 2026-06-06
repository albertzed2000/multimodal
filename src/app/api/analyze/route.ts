import { NextRequest, NextResponse } from "next/server";
import { analyzePathfinderProfile } from "@/lib/pathfinder-analyzer";
import {
  buildConversationChunks,
  buildParseStats,
  extractUserMessages,
  normalizeConversationPayload,
} from "@/lib/pathfinder";
import { saveProfile } from "@/lib/pathfinder-store";

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

    try {
      const result = await analyzePathfinderProfile({ messages, chunks });
      const saved = await saveProfile({
        profile: result.profile,
        stats,
        source: result.source,
      });

      return NextResponse.json({
        profile: result.profile,
        profileId: saved.profileId,
        stats,
        source: result.source,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Analysis failed.",
          details: error instanceof Error ? error.message : "Unknown analysis error.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown analysis error.",
      },
      { status: 500 },
    );
  }
}
