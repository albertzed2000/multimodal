import { NextRequest, NextResponse } from "next/server";
import { generateMoreTasksForDestination } from "@/lib/pathfinder-analyzer";
import { buildFallbackWorld } from "@/lib/pathfinder";
import { updateProfile } from "@/lib/pathfinder-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;

  try {
    const body = (await request.json()) as { destinationId?: string; count?: number };
    if (!body.destinationId) {
      return NextResponse.json({ error: "Missing destinationId." }, { status: 400 });
    }

    const saved = await updateProfile(profileId, async (current) => {
      const profile = {
        ...current.profile,
        world: current.profile.world ?? buildFallbackWorld(current.profile),
      };
      const tasks = await generateMoreTasksForDestination({
        profile,
        destinationId: body.destinationId!,
        count: body.count ?? 5,
      });

      return {
        ...current,
        profile: {
          ...profile,
          world: {
            ...profile.world,
            destinations: profile.world.destinations.map((destination) =>
              destination.id === body.destinationId
                ? { ...destination, backupTasks: [...destination.backupTasks, ...tasks] }
                : destination,
            ),
          },
        },
      };
    });

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task generation failed." },
      { status: 500 },
    );
  }
}
