import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType, HabitGoalType } from '@prisma/client';

interface HabitUpdateInput {
  name?: string;
  description?: string | null;
  type?: HabitType;
  goalType?: HabitGoalType;
  frequency?: number;
  periodInDays?: number | null; // Allow unsetting if goalType changes
  tags?: string[];
  archived?: boolean;
}

function validateHabitUpdateInput(data: any): { isValid: boolean; errors?: any; data?: HabitUpdateInput } {
  // Similar validation as create, but all fields are optional
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty if provided.' } };
  }
  if (data.type !== undefined && !Object.values(HabitType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid habit type.' } };
  }
  if (data.goalType !== undefined && !Object.values(HabitGoalType).includes(data.goalType)) {
    return { isValid: false, errors: { goalType: 'Invalid goal type.' } };
  }
  if (data.frequency !== undefined && (typeof data.frequency !== 'number' || data.frequency <= 0)) {
    return { isValid: false, errors: { frequency: 'Frequency must be a positive number if provided.'}};
  }
  if (data.goalType === HabitGoalType.TIMES_PER_PERIOD &&
      (data.periodInDays === undefined || data.periodInDays === null || (typeof data.periodInDays === 'number' && data.periodInDays <=0))
     ) {
      // If goalType is changing TO TIMES_PER_PERIOD, periodInDays becomes required (unless already set)
      // If goalType is already TIMES_PER_PERIOD, periodInDays must be positive if provided
      // This logic can be complex depending on how you want to handle partial updates.
      // For now, if periodInDays is explicitly in payload for this type, it must be positive.
      if (data.periodInDays !== undefined && (data.periodInDays === null || (typeof data.periodInDays === 'number' && data.periodInDays <=0))) {
        return { isValid: false, errors: { periodInDays: 'Period (in days) must be positive for TIMES_PER_PERIOD goal type if provided.'}};
      }
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    return { isValid: false, errors: { tags: 'Tags must be an array of strings.'}};
  }
  if (data.archived !== undefined && typeof data.archived !== 'boolean') {
    return { isValid: false, errors: { archived: 'Archived must be a boolean.'}};
  }
  return { isValid: true, data: data as HabitUpdateInput };
}


// GET /api/habits/[habitId]
export async function GET(req: NextRequest, { params }: { params: { habitId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const habit = await prisma.habit.findUnique({
      where: { id: params.habitId, userId: session.user.id },
      // include: { logs: { orderBy: { date: 'desc' }, take: 10 } } // Optionally include recent logs
    });
    if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch habit' }, { status: 500 });
  }
}

// PATCH /api/habits/[habitId]
export async function PATCH(req: NextRequest, { params }: { params: { habitId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: HabitUpdateInput;
  try { body = await req.json(); }
  catch (e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validation = validateHabitUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input', details: validation.errors }, { status: 400 });
  }

  const updateData = { ...validation.data };
  // If goalType is changed away from TIMES_PER_PERIOD, nullify periodInDays
  if (updateData.goalType && updateData.goalType !== HabitGoalType.TIMES_PER_PERIOD) {
    updateData.periodInDays = null;
  }


  try {
    const existingHabit = await prisma.habit.findUnique({ where: { id: params.habitId, userId: session.user.id }});
    if (!existingHabit) return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });

    const updatedHabit = await prisma.habit.update({
      where: { id: params.habitId },
      data: updateData,
    });
    return NextResponse.json(updatedHabit);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
  }
}

// DELETE /api/habits/[habitId]
export async function DELETE(req: NextRequest, { params }: { params: { habitId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const existingHabit = await prisma.habit.findUnique({ where: { id: params.habitId, userId: session.user.id }});
    if (!existingHabit) return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });

    // Transaction to delete habit and its logs
    await prisma.$transaction([
      prisma.habitLog.deleteMany({ where: { habitId: params.habitId, userId: session.user.id } }),
      prisma.habit.delete({ where: { id: params.habitId, userId: session.user.id } }),
    ]);
    return NextResponse.json({ message: 'Habit deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 });
  }
}
