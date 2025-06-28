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
    const skillTree = await prisma.skillTree.findUnique({
      where: { id: pathId, userId: userId },
      include: {
        nodes: { // Corresponds to 'steps' conceptually
          // orderBy: { positionY: 'asc', positionX: 'asc' }, // Example ordering, if nodes have position
          include: {
            skill: { select: { id: true, name: true, currentLevel: true } },
            // Quest relation does not exist on SkillTreeNode, remove for now
            // quest: { select: { id: true, title: true, status: true } },
          }
        },
      },
    });

    if (!skillTree) {
      return NextResponse.json({ error: 'Skill Tree (Path) not found or access denied' }, { status: 404 });
    }
    // Rename to 'path' for consistency with frontend if it expects 'path' and 'steps'
    const pathResponse = {
        ...skillTree,
        steps: skillTree.nodes.map(node => ({
            ...node,
            // map other node fields if necessary to match expected "step" structure
        }))
    };
    // delete (pathResponse as any).nodes; // remove original nodes if steps fully replaces it

    return NextResponse.json(pathResponse);
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
