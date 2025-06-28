// Summary: API routes for creating and listing Skill Goals.
// NOTE: SkillGoal model does not exist in the current Prisma schema.
// These routes will return 501 Not Implemented until the schema is updated.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db';
// import { Skill } from '@prisma/client'; // For checking skill ownership if needed

// GET /api/skill-goals - Get all skill goals for the user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: SkillGoal model is missing from the schema.' },
    { status: 501 }
  );
}

// POST /api/skill-goals - Create a new skill goal
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: SkillGoal model is missing from the schema.' },
    { status: 501 }
  );
}
