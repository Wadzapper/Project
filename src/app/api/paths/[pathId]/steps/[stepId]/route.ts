import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Input for updating a SkillTreeNode (formerly PathStep)
interface SkillTreeNodeUpdateInput {
  notes?: string | null;
  positionX?: number;
  positionY?: number;
  parentNodeId?: string | null; // For re-parenting
  // 'completed' status is not a direct field on SkillTreeNode.
  // It would be derived from the linked Skill's status or quest status.
}

function validateSkillTreeNodeUpdateInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeNodeUpdateInput } {
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string.' } };
  }
  if (data.positionX !== undefined && typeof data.positionX !== 'number') {
    return { isValid: false, errors: { positionX: 'Position X must be a number.'}};
  }
  if (data.positionY !== undefined && typeof data.positionY !== 'number') {
    return { isValid: false, errors: { positionY: 'Position Y must be a number.'}};
  }
  if (data.parentNodeId !== undefined && typeof data.parentNodeId !== 'string' && data.parentNodeId !== null) {
     return { isValid: false, errors: { parentNodeId: 'Parent Node ID must be a string or null.' } };
  }

  const updateKeys = Object.keys(data);
  if (updateKeys.length === 0) {
    return { isValid: false, errors: { general: 'At least one field (notes, positionX, positionY, parentNodeId) must be provided for update.'}}
  }
  if (!updateKeys.some(key => ['notes', 'positionX', 'positionY', 'parentNodeId'].includes(key))) {
      return { isValid: false, errors: { general: 'Only notes, positionX, positionY, or parentNodeId can be updated.'}}
  }

  return { isValid: true, data: data as SkillTreeNodeUpdateInput };
}

// PATCH /api/paths/[pathId]/steps/[stepId] - Update a SkillTreeNode
export async function PATCH(
  req: NextRequest,
  { params }: { params: { pathId: string; stepId: string } } // pathId is skillTreeId, stepId is skillTreeNodeId
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { pathId: skillTreeId, stepId: skillTreeNodeId } = params;

  if (!skillTreeId || !skillTreeNodeId) {
    return NextResponse.json({ error: 'Skill Tree ID (Path ID) and Node ID (Step ID) are required' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillTreeNodeUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input for skill tree node update', details: validation.errors }, { status: 400 });
  }

  const { notes, positionX, positionY, parentNodeId } = validation.data;

  try {
    // Verify user owns the skill tree and the node belongs to that tree
    const skillTreeNode = await prisma.skillTreeNode.findUnique({
      where: { id: skillTreeNodeId },
      include: { skillTree: true }, // To check userId and skillTreeId
    });

    if (!skillTreeNode || skillTreeNode.skillTree.id !== skillTreeId || skillTreeNode.skillTree.userId !== userId) {
      return NextResponse.json({ error: 'Skill Tree Node not found or access denied' }, { status: 404 });
    }

    // If parentNodeId is being updated, validate it exists in the same tree
    if (parentNodeId !== undefined) { // Allows setting parentNodeId to null (detaching)
        if (parentNodeId !== null) { // If not null, check if it exists
            const parentNode = await prisma.skillTreeNode.findUnique({
                where: { id: parentNodeId, skillTreeId: skillTreeId }
            });
            if (!parentNode) {
                return NextResponse.json({ error: 'New parent node not found in this skill tree.' }, { status: 404 });
            }
             if (parentNodeId === skillTreeNodeId) { // Prevent self-parenting
                return NextResponse.json({ error: 'Node cannot be its own parent.' }, { status: 400 });
            }
        }
    }


    const dataToUpdate: { metadata?: any, positionX?: number, positionY?: number, parentNodeId?: string | null } = {};

    if (notes !== undefined) {
        const currentMetadata = (skillTreeNode.metadata || {}) as any;
        dataToUpdate.metadata = { ...currentMetadata, notes: notes };
    }
    if (positionX !== undefined) dataToUpdate.positionX = positionX;
    if (positionY !== undefined) dataToUpdate.positionY = positionY;
    if (parentNodeId !== undefined) dataToUpdate.parentNodeId = parentNodeId;


    if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json({ message: "No changes provided.", currentData: skillTreeNode }, { status: 200 });
    }

    const updatedSkillTreeNode = await prisma.skillTreeNode.update({
      where: { id: skillTreeNodeId },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedSkillTreeNode);
  } catch (error) {
    console.error(`Error updating skill tree node ${skillTreeNodeId} in tree ${skillTreeId}:`, error);
    return NextResponse.json({ error: 'Failed to update skill tree node' }, { status: 500 });
  }
}

// DELETE /api/paths/[pathId]/steps/[stepId] - Delete a SkillTreeNode
export async function DELETE(
  req: NextRequest,
  { params }: { params: { pathId: string; stepId: string } } // pathId is skillTreeId, stepId is skillTreeNodeId
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { pathId: skillTreeId, stepId: skillTreeNodeId } = params;

   if (!skillTreeId || !skillTreeNodeId) {
    return NextResponse.json({ error: 'Skill Tree ID (Path ID) and Node ID (Step ID) are required' }, { status: 400 });
  }

  try {
    // Verify user owns the skill tree and the node belongs to that tree
    const skillTreeNode = await prisma.skillTreeNode.findFirst({ // findFirst to check ownership before delete
      where: {
        id: skillTreeNodeId,
        skillTreeId: skillTreeId,
        skillTree: {
            userId: userId
        }
       },
    });

    if (!skillTreeNode) {
      return NextResponse.json({ error: 'Skill Tree Node not found or access denied' }, { status: 404 });
    }

    // Before deleting, check if this node is a parent to any other nodes.
    // Prisma by default might restrict deletion if it's a parent (depending on relation settings like onDelete).
    // Here, parentNodeId is optional, and onDelete is NoAction, so Prisma will throw error if children exist.
    // We should either disallow deleting parent nodes with children, or re-parent children (e.g. to null or grandparent).
    // For MVP, let's disallow deleting if it has children.
    const childrenCount = await prisma.skillTreeNode.count({
        where: { parentNodeId: skillTreeNodeId }
    });

    if (childrenCount > 0) {
        return NextResponse.json({ error: 'Cannot delete node with children. Re-parent children first or delete them.' }, { status: 400 });
    }

    await prisma.skillTreeNode.delete({
      where: { id: skillTreeNodeId },
    });

    return NextResponse.json({ message: 'Skill Tree Node deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`Error deleting skill tree node ${skillTreeNodeId} in tree ${skillTreeId}:`, error);
    if (error.code === 'P2025' || error.code === 'P2014') { // P2014: relation constraint violation (children exist)
        return NextResponse.json({ error: 'Failed to delete node. It might not exist or has dependencies (children nodes).' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to delete skill tree node' }, { status: 500 });
  }
}
