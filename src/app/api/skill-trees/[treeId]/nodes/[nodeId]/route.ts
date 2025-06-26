import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillTreeNodeUpdateInput {
  skillId?: string;
  parentNodeId?: string | null; // Allow unsetting parent
  positionX?: number;
  positionY?: number;
  metadata?: any;
}

// Basic validation for node updates
function validateSkillTreeNodeUpdateInput(data: any): { isValid: boolean; errors?: any; data?: SkillTreeNodeUpdateInput } {
  if (data.skillId !== undefined && (typeof data.skillId !== 'string' || data.skillId.trim().length === 0)) {
    return { isValid: false, errors: { skillId: 'Skill ID cannot be empty if provided.' } };
  }
  if (data.parentNodeId !== undefined && data.parentNodeId !== null && typeof data.parentNodeId !== 'string') {
     return { isValid: false, errors: { parentNodeId: 'Invalid Parent Node ID.' } };
  }
  // Add more validations as needed
  return { isValid: true, data: data as SkillTreeNodeUpdateInput };
}


// PATCH /api/skill-trees/[treeId]/nodes/[nodeId] - Update a specific node
export async function PATCH(
  req: NextRequest,
  { params }: { params: { treeId: string; nodeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId, nodeId } = params;

  // Verify user owns the skill tree
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

  const validation = validateSkillTreeNodeUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  const updateData = validation.data;

  // If skillId is being updated, verify the new skill exists and belongs to the user
  if (updateData.skillId) {
    const skill = await prisma.skill.findUnique({
      where: { id: updateData.skillId, userId: session.user.id },
    });
    if (!skill) {
      return NextResponse.json({ error: 'New Skill ID not found or access denied' }, { status: 400 });
    }
  }

  // If parentNodeId is being updated, verify it exists within the same tree (or is null)
  if (updateData.parentNodeId) {
    const parentNode = await prisma.skillTreeNode.findUnique({
      where: { id: updateData.parentNodeId, skillTreeId: treeId },
    });
    if (!parentNode) {
      return NextResponse.json({ error: 'New Parent Node ID not found in this tree' }, { status: 400 });
    }
    if (updateData.parentNodeId === nodeId) {
      return NextResponse.json({ error: 'Node cannot be its own parent.' }, { status: 400 });
    }
  }

  try {
    // Verify the node exists within the specified tree (user ownership checked via tree)
    const existingNode = await prisma.skillTreeNode.findUnique({
      where: { id: nodeId, skillTreeId: treeId },
    });
    if (!existingNode) {
      return NextResponse.json({ error: 'Node not found in this tree' }, { status: 404 });
    }

    const updatedNode = await prisma.skillTreeNode.update({
      where: { id: nodeId },
      data: {
        ...updateData,
        // Ensure parentNodeId can be explicitly set to null
        parentNodeId: updateData.parentNodeId === null ? null : updateData.parentNodeId || existingNode.parentNodeId,
      },
      include: { skill: true }
    });
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error(`Error updating skill tree node ${nodeId}:`, error);
    return NextResponse.json({ error: 'Failed to update skill tree node' }, { status: 500 });
  }
}


// DELETE /api/skill-trees/[treeId]/nodes/[nodeId] - Delete a specific node
export async function DELETE(
  req: NextRequest,
  { params }: { params: { treeId: string; nodeId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { treeId, nodeId } = params;

  // Verify user owns the skill tree
  const skillTree = await prisma.skillTree.findUnique({
    where: { id: treeId, userId: session.user.id },
  });
  if (!skillTree) {
    return NextResponse.json({ error: 'Skill Tree not found or access denied' }, { status: 404 });
  }

  try {
    // Verify the node exists within the specified tree
    const existingNode = await prisma.skillTreeNode.findUnique({
      where: { id: nodeId, skillTreeId: treeId },
    });
    if (!existingNode) {
      return NextResponse.json({ error: 'Node not found in this tree' }, { status: 404 });
    }

    // Before deleting, check if this node is a parent to any other nodes.
    // If so, those children's parentNodeId might need to be set to null or handled.
    // For simplicity in MVP, we might allow deletion, or reject if it has children.
    // Let's reject if it has children to prevent orphaned branches without explicit reparenting logic.
    const childrenCount = await prisma.skillTreeNode.count({
      where: { parentNodeId: nodeId }
    });

    if (childrenCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete node with children. Please remove or reparent children first.'
      }, { status: 400 });
    }

    await prisma.skillTreeNode.delete({
      where: { id: nodeId },
    });
    return NextResponse.json({ message: 'Skill Tree Node deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting skill tree node ${nodeId}:`, error);
    return NextResponse.json({ error: 'Failed to delete skill tree node' }, { status: 500 });
  }
}
