// Summary: API routes for creating and listing Skill Goals.
// TODO: Add validation for targetXP (must be > skill's current XP if that's a rule).
// TODO: Consider if dueDate should be validated (e.g., not in the past for new goals).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface SkillGoalInput {
  skillId: string;
  targetXP: number;
  dueDate?: string | null; // ISO date string
  notes?: string | null;
}

function validateSkillGoalInput(data: any): { isValid: boolean; errors?: any; data?: SkillGoalInput } {
  if (!data.skillId || typeof data.skillId !== 'string') {
    return { isValid: false, errors: { skillId: 'Skill ID is required.' } };
  }
  if (data.targetXP === undefined || typeof data.targetXP !== 'number' || data.targetXP <= 0) {
    // Assuming targetXP should be greater than current XP, but that check needs current skill data.
    // For now, just positive.
    return { isValid: false, errors: { targetXP: 'Target XP must be a positive number.' } };
  }
  if (data.dueDate !== undefined && data.dueDate !== null) {
    if (typeof data.dueDate !== 'string' || isNaN(new Date(data.dueDate).getTime())) {
      return { isValid: false, errors: { dueDate: 'Invalid due date format.' } };
    }
  }
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string.' } };
  }
  return { isValid: true, data: data as SkillGoalInput };
}

// GET /api/skill-goals - Get all skill goals for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const isCompleteParam = searchParams.get('isComplete'); // "true", "false", or null/undefined

  const whereClause: any = { userId: userId };
  if (isCompleteParam === 'true') {
    whereClause.isComplete = true;
  } else if (isCompleteParam === 'false') {
    whereClause.isComplete = false;
  }
  // If param is not provided, fetch all (both complete and incomplete).

  try {
    const skillGoals = await prisma.skillGoal.findMany({
      where: whereClause,
      include: {
        skill: { // Include related skill's name and current XP for context
          select: { name: true, currentXp: true, currentLevel: true },
        },
      },
      orderBy: [{ isComplete: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    // Logic to auto-complete goals if skill's currentXP >= targetXP
    const updatedGoals = await Promise.all(skillGoals.map(async (goal) => {
      if (!goal.isComplete && goal.skill.currentXp >= goal.targetXP) {
        try {
          return await prisma.skillGoal.update({
            where: { id: goal.id },
            data: { isComplete: true, completedAt: new Date() },
            include: { skill: { select: { name: true, currentXp: true, currentLevel: true } } },
          });
        } catch (updateError) {
          console.error(`Failed to auto-complete skill goal ${goal.id}:`, updateError);
          return goal; // Return original goal if update fails
        }
      }
      return goal;
    }));

    return NextResponse.json(updatedGoals);
  } catch (error) {
    console.error('Error fetching skill goals:', error);
    return NextResponse.json({ error: 'Failed to fetch skill goals' }, { status: 500 });
  }
}

// POST /api/skill-goals - Create a new skill goal
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 }); }

  const validation = validateSkillGoalInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { skillId, targetXP, dueDate, notes } = validation.data;

  try {
    // Verify skillId exists and belongs to user
    const skill = await prisma.skill.findUnique({
      where: { id: skillId, userId: userId },
    });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found or access denied.' }, { status: 404 });
    }

    // Optional: Check if targetXP is greater than current skill.currentXp
    if (targetXP <= skill.currentXp) {
        // Allow creating goals already met or below current XP? Or return error?
        // For MVP, allow it. User might want to log a past achievement as a goal.
        // Or, could auto-mark as complete if targetXP <= skill.currentXp
    }

    const isAlreadyComplete = skill.currentXp >= targetXP;

    const newSkillGoal = await prisma.skillGoal.create({
      data: {
        userId,
        skillId,
        targetXP,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        isComplete: isAlreadyComplete,
        completedAt: isAlreadyComplete ? new Date() : null,
      },
      include: { skill: {select: {name: true, currentXp: true, currentLevel: true}}}
    });
    return NextResponse.json(newSkillGoal, { status: 201 });
  } catch (error) {
    console.error('Error creating skill goal:', error);
    return NextResponse.json({ error: 'Failed to create skill goal' }, { status: 500 });
  }
}
