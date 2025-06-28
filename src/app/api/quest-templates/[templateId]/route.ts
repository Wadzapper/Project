// Summary: API routes for managing individual Quest Templates (GET, PATCH, DELETE).
// NOTE: QuestTemplate model does not exist in the current Prisma schema.
// These routes will return 501 Not Implemented until the schema is updated.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db';
// import { QuestType } from '@prisma/client';

// GET /api/quest-templates/[templateId]
export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: QuestTemplate model is missing from the schema.' },
    { status: 501 }
  );
}

// PATCH /api/quest-templates/[templateId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: QuestTemplate model is missing from the schema.' },
    { status: 501 }
  );
}

// DELETE /api/quest-templates/[templateId] - (Soft delete: archive/unarchive)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: QuestTemplate model is missing from the schema.' },
    { status: 501 }
  );
}
