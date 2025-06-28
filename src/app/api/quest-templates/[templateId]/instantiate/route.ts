// Summary: API route to instantiate a Quest from a QuestTemplate.
// NOTE: QuestTemplate model does not exist in the current Prisma schema.
// This route will return 501 Not Implemented until the schema is updated.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db';
// import { QuestStatus, QuestDependencyType, QuestType } from '@prisma/client';

export async function POST(
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
