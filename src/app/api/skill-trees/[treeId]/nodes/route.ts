import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillTreeNodeInput {
  skillId: string;
  parentNodeId?: string | null;
  positionX?: number;
  positionY?: number;
  metadata?: any;
}

function validateSkillTreeNodeInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeNodeInput } {
  if (!data.skillId || typeof data.skillId !== 'string') {
    return { isValid: false, errors: { skillId: 'Skill ID is required.' } };
  }
  if (data.parentNodeId !== undefined && data.parentNodeId !== null && typeof data.parentNodeId !== 'string') {
    return { isValid: false, errors: { parentNodeId: 'Invalid Parent Node ID.' } };
  }
  // Add more validations for position, metadata etc. if needed
  return { isValid: true, data: data as SkillTreeNodeInput };
}

// POST /api/skill-trees/[treeId]/nodes - Create a new node in a skill tree
export async function POST(
  req: NextRequest,
  { params }: { params: { treeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId } = params;

  // Check if the user owns the skill tree
  const skillTree = await prisma.skillTree.findUnique({
    where: { id: treeId, userId: session.user.id },
  });

  if (!skillTree) {
    return NextResponse.json({ error: 'Skill Tree not found or access denied' }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillTreeNodeInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { skillId, parentNodeId, positionX, positionY, metadata } = validation.data;

  // Verify the skill exists and belongs to the user (or is a public/shared skill if that feature is added later)
  const skill = await prisma.skill.findUnique({
    where: { id: skillId, userId: session.user.id },
  });
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found or access denied' }, { status: 404 });
  }

  // If parentNodeId is provided, verify it exists within the same tree
  if (parentNodeId) {
    const parentNode = await prisma.skillTreeNode.findUnique({
      where: { id: parentNodeId, skillTreeId: treeId },
    });
    if (!parentNode) {
      return NextResponse.json({ error: 'Parent node not found in this tree' }, { status: 400 });
    }
  }

  try {
    const newNode = await prisma.skillTreeNode.create({
      data: {
        skillTreeId: treeId,
        skillId,
        parentNodeId: parentNodeId || null,
        positionX: positionX === undefined ? 0 : positionX,
        positionY: positionY === undefined ? 0 : positionY,
        metadata: metadata || undefined,
      },
      include: { // Return the created node with its skill details
        skill: true,
      }
    });
    return NextResponse.json(newNode, { status: 201 });
  } catch (error) {
    console.error('Error creating skill tree node:', error);
    return NextResponse.json({ error: 'Failed to create skill tree node' }, { status: 500 });
  }
}
