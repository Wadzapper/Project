import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
// PathStepType might not be directly applicable to SkillTreeNode in the same way.
// A SkillTreeNode is inherently a 'SKILL' type step.
// If Quest steps were needed, the schema would need a different model for "PathStep"
// that can link to either Skill or Quest polymorphically, or SkillTreeNodes would need a type field.

interface SkillTreeNodeInput {
  skillId: string; // Required: The ID of the skill to add as a node
  parentNodeId?: string | null; // Optional: For creating tree structure
  positionX?: number;
  positionY?: number;
  notes?: string | null; // Could be stored in metadata
  // 'order' and 'type' from old PathStepInput are not directly applicable to SkillTreeNode
}

function validateSkillTreeNodeInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeNodeInput } {
  if (!data.skillId || typeof data.skillId !== 'string') {
    return { isValid: false, errors: { skillId: 'Skill ID is required.' } };
  }
  // Add other validations as needed for parentNodeId, positions, etc.
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string.' } };
  }
  if (data.positionX !== undefined && typeof data.positionX !== 'number') {
    return { isValid: false, errors: { positionX: 'Position X must be a number.'}};
  }
  if (data.positionY !== undefined && typeof data.positionY !== 'number') {
    return { isValid: false, errors: { positionY: 'Position Y must be a number.'}};
  }
  return { isValid: true, data: data as SkillTreeNodeInput };
}

// POST /api/paths/[pathId]/steps - Add a new SkillTreeNode to a SkillTree
export async function POST(
  req: NextRequest,
  { params }: { params: { pathId: string } } // pathId here refers to skillTreeId
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const skillTreeId = params.pathId; // pathId is skillTreeId

  if (!skillTreeId) {
    return NextResponse.json({ error: 'Skill Tree ID (Path ID) is required' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillTreeNodeInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input for skill tree node', details: validation.errors }, { status: 400 });
  }

  const { skillId, parentNodeId, positionX, positionY, notes } = validation.data;

  try {
    // Verify user owns the skill tree (path)
    const skillTree = await prisma.skillTree.findUnique({
      where: { id: skillTreeId, userId: userId },
    });
    if (!skillTree) {
      return NextResponse.json({ error: 'Skill Tree (Path) not found or access denied' }, { status: 404 });
    }

    // Validate referenced skill exists and belongs to user
    const skill = await prisma.skill.findUnique({ where: { id: skillId, userId: userId } });
    if (!skill) return NextResponse.json({ error: 'Skill not found or access denied.' }, { status: 404 });

    // If parentNodeId is provided, validate it exists within the same tree
    if (parentNodeId) {
        const parentNode = await prisma.skillTreeNode.findUnique({
            where: { id: parentNodeId, skillTreeId: skillTreeId }
        });
        if (!parentNode) {
            return NextResponse.json({ error: 'Parent node not found in this skill tree.' }, { status: 404 });
        }
    }

    // For simplicity, new nodes are added without complex order/positioning logic here.
    // Frontend might send positionX, positionY.
    // 'order' is not a field on SkillTreeNode.
    const newSkillTreeNode = await prisma.skillTreeNode.create({
      data: {
        skillTreeId: skillTreeId,
        skillId: skillId,
        parentNodeId: parentNodeId || null,
        positionX: positionX || 0, // Default positions or allow client to send
        positionY: positionY || 0,
        metadata: notes ? { notes } : undefined,
      },
    });
    return NextResponse.json(newSkillTreeNode, { status: 201 });
  } catch (error: any) {
    console.error(`Error adding node to skill tree ${skillTreeId}:`, error);
    // P2002 can happen if e.g. skillId + skillTreeId is made unique and it's violated
    return NextResponse.json({ error: 'Failed to add node to skill tree' }, { status: 500 });
  }
}
