import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface PathStepUpdateInput {
  completed?: boolean;
  notes?: string | null;
  // Potentially order could be updatable here too, but that's more complex (reordering other steps)
}

function validatePathStepUpdateInput(data: any): { isValid: boolean; errors?: any; data?: PathStepUpdateInput } {
  if (data.completed !== undefined && typeof data.completed !== 'boolean') {
    return { isValid: false, errors: { completed: 'Completed status must be a boolean.' } };
  }
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string.' } };
  }
  if (Object.keys(data).length === 0) {
    return { isValid: false, errors: { general: 'At least one field (completed or notes) must be provided for update.'}}
  }
  return { isValid: true, data: data as PathStepUpdateInput };
}

// PATCH /api/paths/[pathId]/steps/[stepId] - Update a path step (e.g., mark as complete/incomplete, update notes)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { pathId: string; stepId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { pathId, stepId } = params;

  if (!pathId || !stepId) {
    return NextResponse.json({ error: 'Path ID and Step ID are required' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validatePathStepUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input for path step update', details: validation.errors }, { status: 400 });
  }

  const updateData = validation.data;

  try {
    // Verify user owns the path and the step belongs to that path
    const pathStep = await prisma.pathStep.findUnique({
      where: { id: stepId },
      include: { path: true },
    });

    if (!pathStep || pathStep.path.id !== pathId || pathStep.path.userId !== userId) {
      return NextResponse.json({ error: 'Path step not found or access denied' }, { status: 404 });
    }

    // For MVP, manual completion is allowed.
    // Future: Could add logic here to check if underlying skill/quest is actually met
    // if `body.completed` is true. This would involve fetching the skill/quest and evaluating it.
    // For now, we trust the client's `completed` flag for manual override.

    const updatedStep = await prisma.pathStep.update({
      where: { id: stepId },
      data: {
        completed: updateData.completed,
        notes: updateData.notes, // Update notes if provided
      },
    });

    // Optional: Check if all steps in the path are complete, then update Path status (not in schema yet)
    // const pathSteps = await prisma.pathStep.findMany({ where: { pathId: pathId }});
    // const allComplete = pathSteps.every(s => s.completed);
    // if (allComplete) { /* update path.status to COMPLETED */ }

    return NextResponse.json(updatedStep);
  } catch (error) {
    console.error(`Error updating path step ${stepId} in path ${pathId}:`, error);
    return NextResponse.json({ error: 'Failed to update path step' }, { status: 500 });
  }
}

// Note: DELETE for /api/paths/[pathId]/steps/[stepId] would go here.
// This would also require re-ordering subsequent steps if 'order' is managed tightly.
// For MVP, deleting steps might be deferred or handled by client sending updates to all affected orders.
// Simplest MVP delete: just delete the step, client refetches ordered list.
/*
export async function DELETE(
  req: NextRequest,
  { params }: { params: { pathId: string; stepId: string } }
) {
  // ... auth, validation ...
  // ... ensure user owns path and step ...
  // await prisma.pathStep.delete({ where: { id: stepId }});
  // Potentially re-order other steps:
  // const remainingSteps = await prisma.pathStep.findMany({ where: { pathId, order: { gt: deletedStep.order } }, orderBy: { order: 'asc' }});
  // for (let i = 0; i < remainingSteps.length; i++) {
  //   await prisma.pathStep.update({ where: { id: remainingSteps[i].id }, data: { order: deletedStep.order + i }});
  // }
}
*/
