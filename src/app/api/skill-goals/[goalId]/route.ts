// Summary: API routes for managing individual Skill Goals (GET, PATCH, DELETE).
// NOTE: SkillGoal model does not exist in the current Prisma schema.
// These routes will return 501 Not Implemented until the schema is updated.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db';
// import { Skill } from '@prisma/client'; // For checking skill ownership if needed

// GET /api/skill-goals/[goalId] - Get a specific skill goal
export async function GET(
  req: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: SkillGoal model is missing from the schema.' },
    { status: 501 }
  );
}

// PATCH /api/skill-goals/[goalId] - Update a skill goal
export async function PATCH(
  req: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: SkillGoal model is missing from the schema.' },
    { status: 501 }
  );
}

// DELETE /api/skill-goals/[goalId] - Delete a skill goal
export async function DELETE(
  req: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: SkillGoal model is missing from the schema.' },
    { status: 501 }
  );
}
