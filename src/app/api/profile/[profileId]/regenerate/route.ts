import { NextRequest, NextResponse } from "next/server";
import { regenerateProfileAfterCompletion } from "@/lib/pathfinder-analyzer";
import { buildFallbackWorld, PathfinderTask } from "@/lib/pathfinder";
import { updateProfile } from "@/lib/pathfinder-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;

  try {
    const body = (await request.json()) as { completedTask?: PathfinderTask };
    if (!body.completedTask) {
      return NextResponse.json({ error: "Missing completedTask." }, { status: 400 });
    }

    const saved = await updateProfile(profileId, async (current) => ({
      ...current,
      profile: await regenerateProfileAfterCompletion({
        profile: {
          ...current.profile,
          world: current.profile.world ?? buildFallbackWorld(current.profile),
        },
        completedTask: body.completedTask!,
      }),
    }));

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile regeneration failed." },
      { status: 500 },
    );
  }
}
