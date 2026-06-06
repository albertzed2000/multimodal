import { NextRequest, NextResponse } from "next/server";
import { readProfile } from "@/lib/pathfinder-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;

  try {
    const saved = await readProfile(profileId);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
}
