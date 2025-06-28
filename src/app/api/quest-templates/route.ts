// Summary: API routes for creating and listing Quest Templates.
// NOTE: QuestTemplate model does not exist in the current Prisma schema.
// These routes will return 501 Not Implemented until the schema is updated.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db';
// import { QuestType } from '@prisma/client';

// GET /api/quest-templates - Get all non-archived quest templates
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: QuestTemplate model is missing from the schema.' },
    { status: 501 }
  );
}

// POST /api/quest-templates - Create a new quest template
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: QuestTemplate model is missing from the schema.' },
    { status: 501 }
  );
}
