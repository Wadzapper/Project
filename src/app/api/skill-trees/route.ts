import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillTreeInput {
  name: string;
  description?: string;
}

function validateSkillTreeInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  return { isValid: true, data: data as SkillTreeInput };
}

// GET /api/skill-trees - Get all skill trees for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const skillTrees = await prisma.skillTree.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      // Optionally include nodes or node count if needed for list view
      // include: { _count: { select: { nodes: true } } }
    });
    return NextResponse.json(skillTrees);
  } catch (error) {
    console.error('Error fetching skill trees:', error);
    return NextResponse.json({ error: 'Failed to fetch skill trees' }, { status: 500 });
  }
}

// POST /api/skill-trees - Create a new skill tree for the authenticated user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillTreeInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description } = validation.data;

  try {
    const newSkillTree = await prisma.skillTree.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
      },
    });
    return NextResponse.json(newSkillTree, { status: 201 });
  } catch (error) {
    console.error('Error creating skill tree:', error);
    return NextResponse.json({ error: 'Failed to create skill tree' }, { status: 500 });
  }
}
