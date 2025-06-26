import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// GET /api/paths/[pathId] - Get a specific path with its steps
export async function GET(
  req: NextRequest,
  { params }: { params: { pathId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { pathId } = params;

  if (!pathId) {
    return NextResponse.json({ error: 'Path ID is required' }, { status: 400 });
  }

  try {
    const path = await prisma.path.findUnique({
      where: { id: pathId, userId: userId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { // Include skill/quest details for context if needed by UI
            skill: { select: { id: true, name: true, currentLevel: true } }, // Example fields
            quest: { select: { id: true, title: true, status: true } },     // Example fields
          }
        },
      },
    });

    if (!path) {
      return NextResponse.json({ error: 'Path not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(path);
  } catch (error) {
    console.error(`Error fetching path ${pathId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch path' }, { status: 500 });
  }
}

// Note: PATCH and DELETE for /api/paths/[pathId] (i.e., updating/deleting the Path itself)
// are not in the MVP scope for this cycle but would be added here.
// For example, to update path name/description:
/*
export async function PATCH(
  req: NextRequest,
  { params }: { params: { pathId: string } }
) {
  // ... auth, validation ...
  // ... prisma.path.update(...) ...
}
*/
