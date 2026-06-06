import { NextRequest, NextResponse } from "next/server";
import { readJob } from "@/lib/pathfinder-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  try {
    const job = await readJob(jobId);
    return NextResponse.json({
      ...job,
      profileUrl: job.profileId ? `/api/profile/${job.profileId}` : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
}
