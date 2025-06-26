import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillTreeUpdateInput {
  name?: string;
  description?: string;
  // Node updates will be handled by separate endpoints or a more complex PATCH body later
}

function validateSkillTreeUpdateInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeUpdateInput } {
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty if provided.' } };
  }
  return { isValid: true, data: data as SkillTreeUpdateInput };
}

// GET /api/skill-trees/[treeId] - Get a single skill tree by ID, including its nodes and their skill details
export async function GET(
  req: NextRequest,
  { params }: { params: { treeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId } = params;

  try {
    const skillTree = await prisma.skillTree.findUnique({
      where: { id: treeId, userId: session.user.id },
      include: {
        nodes: {
          include: {
            skill: { // Select specific fields from skill for the node
              select: {
                id: true,
                name: true,
                currentLevel: true,
                currentXp: true,
                targetXpForNextLevel: true,
                description: true, // Optional: if needed for quick view on node
                // colorCode: true // Optional
              }
            }
          },
          orderBy: { positionY: 'asc', positionX: 'asc' },
        },
      },
    });

    if (!skillTree) {
      return NextResponse.json({ error: 'Skill Tree not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(skillTree);
  } catch (error) {
    console.error(`Error fetching skill tree ${treeId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch skill tree' }, { status: 500 });
  }
}

// PATCH /api/skill-trees/[treeId] - Update a skill tree's basic details (name, description)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { treeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId } = params;
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  // For now, this PATCH only updates name/description of the SkillTree itself.
  // Node manipulation will be handled by specific node endpoints or a more complex tree update later.
  const { name, description } = body;
  const updateData: SkillTreeUpdateInput = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;


  const validation = validateSkillTreeUpdateInput(updateData);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  try {
    const existingSkillTree = await prisma.skillTree.findUnique({
      where: { id: treeId, userId: session.user.id },
    });

    if (!existingSkillTree) {
      return NextResponse.json({ error: 'Skill Tree not found or access denied' }, { status: 404 });
    }

    const updatedSkillTree = await prisma.skillTree.update({
      where: { id: treeId },
      data: validation.data,
    });
    return NextResponse.json(updatedSkillTree);
  } catch (error) {
    console.error(`Error updating skill tree ${treeId}:`, error);
    return NextResponse.json({ error: 'Failed to update skill tree' }, { status: 500 });
  }
}

// DELETE /api/skill-trees/[treeId] - Delete a skill tree by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { treeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId } = params;

  try {
    const existingSkillTree = await prisma.skillTree.findUnique({
      where: { id: treeId, userId: session.user.id },
    });

    if (!existingSkillTree) {
      return NextResponse.json({ error: 'Skill Tree not found or access denied' }, { status: 404 });
    }

    // Deleting a skill tree will also delete its associated SkillTreeNodes due to onDelete: Cascade
    await prisma.skillTree.delete({
      where: { id: treeId },
    });
    return NextResponse.json({ message: 'Skill Tree deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting skill tree ${treeId}:`, error);
    return NextResponse.json({ error: 'Failed to delete skill tree' }, { status: 500 });
  }
}
