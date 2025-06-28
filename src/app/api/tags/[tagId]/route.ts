// Summary: API routes for managing individual Tags (GET, PATCH, DELETE).
// NOTE: Tag model does not exist in the current Prisma schema.
// Tags are string arrays on other models. These routes will return 501 Not Implemented.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
// import { prisma } from '@/lib/db'; // Not used as Tag model doesn't exist

// GET /api/tags/[tagId] - Get a specific tag
export async function GET(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: Tag model does not exist. Tags are managed as string arrays on related items.' },
    { status: 501 }
  );
}

// PATCH /api/tags/[tagId] - Update a tag (e.g., rename, change color)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
   return NextResponse.json(
    { error: 'Feature Not Implemented: Tag model does not exist. Tags are managed as string arrays on related items.' },
    { status: 501 }
  );
}

// DELETE /api/tags/[tagId] - Delete a tag
// This would involve removing the tag string from all relevant records.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Feature Not Implemented: Tag model does not exist. Tags are managed as string arrays on related items.' },
    { status: 501 }
  );
}
