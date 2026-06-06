import { NextRequest, NextResponse } from "next/server";
import { regenerateProfileAfterCompletion } from "@/lib/pathfinder-analyzer";
import { buildFallbackWorld, PathfinderTask } from "@/lib/pathfinder";
import { updateProfile } from "@/lib/pathfinder-store";

export const runtime = "nodejs";
export const maxDuration = 300;

type TaskAction = "add" | "dismiss" | "complete";

type TaskRequest = {
  action: TaskAction;
  destinationId?: string;
  task: PathfinderTask;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;

  try {
    const body = (await request.json()) as TaskRequest;
    if (!body.action || !body.task) {
      return NextResponse.json({ error: "Missing action or task." }, { status: 400 });
    }

    const saved = await updateProfile(profileId, async (current) => {
      const profile = {
        ...current.profile,
        world: current.profile.world ?? buildFallbackWorld(current.profile),
      };

      if (body.action === "add") {
        return {
          ...current,
          profile: {
            ...profile,
            world: {
              ...profile.world,
              mainTasks: dedupeTasks([...profile.world.mainTasks, body.task]),
            },
          },
        };
      }

      if (body.action === "dismiss") {
        const destinations = profile.world.destinations.map((destination) => {
          if (destination.id !== body.destinationId) return destination;
          const suggestedTasks = destination.suggestedTasks.filter((task) => task.id !== body.task.id);
          const [replacement, ...backupTasks] = destination.backupTasks;
          return {
            ...destination,
            suggestedTasks: replacement
              ? dedupeTasks([...suggestedTasks, replacement]).slice(0, 3)
              : suggestedTasks,
            backupTasks,
          };
        });

        return {
          ...current,
          profile: {
            ...profile,
            world: {
              ...profile.world,
              destinations,
            },
          },
        };
      }

      const regenerated = await regenerateProfileAfterCompletion({
        profile: {
          ...profile,
          world: {
            ...profile.world,
            mainTasks: profile.world.mainTasks.filter((task) => task.id !== body.task.id),
            completedTasks: dedupeTasks([...profile.world.completedTasks, body.task]),
          },
        },
        completedTask: body.task,
      });

      return {
        ...current,
        profile: regenerated,
      };
    });

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task update failed." },
      { status: 500 },
    );
  }
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
