import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Interface for SkillTree (Path) creation input
interface SkillTreeInput {
  name: string;
  description?: string | null;
}

// Validation function for SkillTreeInput
function validateSkillTreeInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Skill Tree name is required.' } };
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    return { isValid: false, errors: { description: 'Description must be a string.' } };
  }
  return { isValid: true, data: data as SkillTreeInput };
}

// GET /api/paths - Get all SkillTrees (Paths) for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const skillTrees = await prisma.skillTree.findMany({ // Changed from prisma.path
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { nodes: true } // Changed from steps to nodes
        }
      }
    });
    // If frontend expects 'steps' count, map it
    const responseData = skillTrees.map(tree => ({
        ...tree,
        _count: {
            steps: tree._count.nodes // Map nodes count to steps count if needed by frontend
        }
    }));
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching skill trees (paths):', error);
    return NextResponse.json({ error: 'Failed to fetch skill trees (paths)' }, { status: 500 });
  }
}

// POST /api/paths - Create a new SkillTree (Path) for the authenticated user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillTreeInput(body); // Updated validation function name
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description } = validation.data;

  try {
    const newSkillTree = await prisma.skillTree.create({ // Changed from prisma.path
      data: {
        userId: userId,
        name: name,
        description: description || null,
      },
    });
    return NextResponse.json(newSkillTree, { status: 201 });
  } catch (error) {
    console.error('Error creating skill tree (path):', error);
    return NextResponse.json({ error: 'Failed to create skill tree (path)' }, { status: 500 });
  }
}
