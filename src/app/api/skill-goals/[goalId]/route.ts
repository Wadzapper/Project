// Summary: API routes for managing individual Skill Goals (PATCH, DELETE).
// TODO: PATCH validation for targetXP (e.g., ensure it's reasonable if changed).
// TODO: Consider implications if a skill is deleted while goals exist (currently onDelete: Cascade for skill relation).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillGoalUpdateInput {
  targetXP?: number;
  dueDate?: string | null; // ISO date string or null to clear
  notes?: string | null;
  isComplete?: boolean; // Allow manual override/completion
}

function validateSkillGoalUpdateInput(data: any): { isValid: boolean; errors?: any; data?: SkillGoalUpdateInput } {
  if (data.targetXP !== undefined && (typeof data.targetXP !== 'number' || data.targetXP <= 0)) {
    return { isValid: false, errors: { targetXP: 'Target XP must be a positive number if provided.' } };
  }
  if (data.dueDate !== undefined && data.dueDate !== null) {
    if (typeof data.dueDate !== 'string' || isNaN(new Date(data.dueDate).getTime())) {
      return { isValid: false, errors: { dueDate: 'Invalid due date format if provided.' } };
    }
  }
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string if provided.' } };
  }
  if (data.isComplete !== undefined && typeof data.isComplete !== 'boolean') {
    return { isValid: false, errors: { isComplete: 'isComplete must be a boolean if provided.' } };
  }
  if (Object.keys(data).length === 0) {
      return { isValid: false, errors: { general: "No update data provided."}}
  }
  return { isValid: true, data: data as SkillGoalUpdateInput };
}

// PATCH /api/skill-goals/[goalId] - Update a skill goal
export async function PATCH(
  req: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { goalId } = params;

  let body;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 }); }

  const validation = validateSkillGoalUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input for update', details: validation.errors }, { status: 400 });
  }

  let updateData = { ...validation.data };

  try {
    const existingGoal = await prisma.skillGoal.findUnique({
      where: { id: goalId, userId: userId },
      include: { skill: { select: { currentXp: true } } }
    });

    if (!existingGoal) {
      return NextResponse.json({ error: 'Skill Goal not found or access denied' }, { status: 404 });
    }

    // Auto-completion logic if not manually setting isComplete, or if targetXP changes
    if (updateData.isComplete === undefined) { // Only auto-complete if not manually setting completion
      const currentTargetXP = updateData.targetXP !== undefined ? updateData.targetXP : existingGoal.targetXP;
      if (existingGoal.skill.currentXp >= currentTargetXP && !existingGoal.isComplete) {
        updateData.isComplete = true;
        updateData.completedAt = new Date();
      }
    } else if (updateData.isComplete === true && !existingGoal.isComplete) {
      // If manually marking as complete, set completedAt
      updateData.completedAt = new Date();
    } else if (updateData.isComplete === false && existingGoal.isComplete) {
      // If manually marking as incomplete, clear completedAt
      updateData.completedAt = null;
    }

    // If dueDate is explicitly passed as null, set it to null. Otherwise, parse if string.
    if (updateData.dueDate === null) {
        updateData.dueDate = null;
    } else if (typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
    }


    const updatedSkillGoal = await prisma.skillGoal.update({
      where: { id: goalId },
      data: updateData,
      include: { skill: {select: {name: true, currentXp: true, currentLevel: true}}}
    });

    return NextResponse.json(updatedSkillGoal);
  } catch (error) {
    console.error(`Error updating skill goal ${goalId}:`, error);
    return NextResponse.json({ error: 'Failed to update skill goal' }, { status: 500 });
  }
}

// DELETE /api/skill-goals/[goalId] - Delete a skill goal
export async function DELETE(
  req: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { goalId } = params;

  try {
    const existingGoal = await prisma.skillGoal.findUnique({
      where: { id: goalId, userId: userId },
    });
    if (!existingGoal) {
      return NextResponse.json({ error: 'Skill Goal not found or access denied' }, { status: 404 });
    }

    await prisma.skillGoal.delete({
      where: { id: goalId },
    });

    return NextResponse.json({ message: 'Skill Goal deleted successfully' }, {status: 200});
  } catch (error) {
    console.error(`Error deleting skill goal ${goalId}:`, error);
    return NextResponse.json({ error: 'Failed to delete skill goal' }, { status: 500 });
  }
}
