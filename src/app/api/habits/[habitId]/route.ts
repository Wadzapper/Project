import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType, HabitGoalType } from '@prisma/client';

interface HabitUpdateInput {
  name?: string;
  description?: string;
  type?: HabitType;
  goalType?: HabitGoalType;
  frequency?: number;
  periodInDays?: number | null;
  tagIds?: string[]; // For updating tags, client sends array of selected tag IDs
  archived?: boolean;
}

// GET a single habit
export async function GET(
  req: NextRequest,
  { params }: { params: { habitId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const habit = await prisma.habit.findUnique({
      where: { id: params.habitId, userId: session.user.id },
      // The `tags` field (String[]) is automatically included.
      // No special `include` is needed for it.
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // The client (e.g. HabitFormModal) might expect initialData.tags to be objects like {id, name, color}.
    // Since our schema stores tags as String[], we'll return them as is.
    // The client will need to adapt or this API could transform them if a central Tag store existed.
    // For now, this matches the schema.
    return NextResponse.json(habit);

  } catch (error) {
    console.error(`Error fetching habit ${params.habitId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch habit' }, { status: 500 });
  }
}


// PATCH (update) a single habit
export async function PATCH(
  req: NextRequest,
  { params }: { params: { habitId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json() as HabitUpdateInput;

    // Validate that the habit belongs to the user before updating
    const existingHabit = await prisma.habit.findUnique({
      where: { id: params.habitId, userId: userId },
    });

    if (!existingHabit) {
      return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });
    }

    const { tagIds, ...habitData } = body;

    const dataToUpdate: any = { ...habitData };
    if (tagIds !== undefined) {
      dataToUpdate.tags = tagIds; // Prisma expects String[] for the 'tags' field
    }

    // Ensure periodInDays is null if goalType is not TIMES_PER_PERIOD
    if (dataToUpdate.goalType && dataToUpdate.goalType !== HabitGoalType.TIMES_PER_PERIOD) {
        dataToUpdate.periodInDays = null;
    } else if (dataToUpdate.goalType === HabitGoalType.TIMES_PER_PERIOD && dataToUpdate.periodInDays === undefined) {
        // If it's TIMES_PER_PERIOD and periodInDays is not provided, keep existing or set a default.
        // For now, we'll let it be undefined if not sent, Prisma will ignore it if not in schema or use default.
        // Or explicitly set to null if that's the desired behavior for an unset period
        dataToUpdate.periodInDays = existingHabit.periodInDays; // Keep existing if not provided
    }


    const updatedHabit = await prisma.habit.update({
      where: { id: params.habitId },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedHabit);

  } catch (error: any) {
    console.error(`Error updating habit ${params.habitId}:`, error);
    if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ error: 'Habit not found for update' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update habit', details: error.message }, { status: 500 });
  }
}


// DELETE a single habit
export async function DELETE(
  req: NextRequest,
  { params }: { params: { habitId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Validate that the habit belongs to the user before deleting
    const habitToDelete = await prisma.habit.findUnique({
      where: { id: params.habitId, userId: userId },
    });

    if (!habitToDelete) {
      return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });
    }

    // Also delete associated HabitLogs
    await prisma.habitLog.deleteMany({
        where: { habitId: params.habitId, userId: userId }
    });

    await prisma.habit.delete({
      where: { id: params.habitId },
    });

    return NextResponse.json({ message: 'Habit deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`Error deleting habit ${params.habitId}:`, error);
     if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ error: 'Habit not found for deletion' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete habit', details: error.message }, { status: 500 });
  }
}
