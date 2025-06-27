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
  tagIds?: string[]; // Changed from tags: string[]
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
      if (data.periodInDays !== undefined && (data.periodInDays === null || (typeof data.periodInDays === 'number' && data.periodInDays <=0))) {
        return { isValid: false, errors: { periodInDays: 'Period (in days) must be positive for TIMES_PER_PERIOD goal type if provided.'}};
      }
  }
  // Validate tagIds if provided
  if (data.tagIds !== undefined && (!Array.isArray(data.tagIds) || !data.tagIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { tagIds: 'tagIds must be an array of strings.' } };
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
      include: { // Include tags when fetching a single habit
        habitTags: {
          select: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      }
    });
    if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });

    const { habitTags, ...habitData } = habit;
    const responseData = {
      ...habitData,
      tags: habitTags.map(ht => ht.tag) // Flatten to simple array of Tag objects
    };
    return NextResponse.json(responseData);
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

  const { tagIds, ...otherUpdateData } = validation.data;
  let updatePayload = { ...otherUpdateData };

  // If goalType is changed away from TIMES_PER_PERIOD, nullify periodInDays
  if (updatePayload.goalType && updatePayload.goalType !== HabitGoalType.TIMES_PER_PERIOD) {
    updatePayload.periodInDays = null;
  }

  try {
    const existingHabit = await prisma.habit.findUnique({ where: { id: params.habitId, userId: session.user.id }});
    if (!existingHabit) return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });

    // Handle tag updates transactionally
    await prisma.$transaction(async (tx) => {
      // Update basic habit fields
      const updatedHabit = await tx.habit.update({
        where: { id: params.habitId },
        data: updatePayload,
      });

      // If tagIds are provided, sync them
      if (tagIds !== undefined) {
        // Validate new tagIds belong to user
        if (tagIds.length > 0) {
            const tagsExistCount = await tx.tag.count({
                where: { id: { in: tagIds }, userId: session.user!.id }
            });
            if (tagsExistCount !== tagIds.length) {
                throw new Error('One or more provided tag IDs for update are invalid or do not belong to the user.');
            }
        }
        // Delete existing tag associations
        await tx.habitTag.deleteMany({
          where: { habitId: params.habitId },
        });
        // Create new tag associations
        if (tagIds.length > 0) {
          await tx.habitTag.createMany({
            data: tagIds.map(tagId => ({
              habitId: params.habitId,
              tagId: tagId,
              assignedBy: session.user!.id!,
            })),
          });
        }
      }
      // Return the updated habit with tags for the response
      // This requires another fetch or careful construction. For now, we'll fetch.
    });

    // Refetch the habit with its updated tags to return in the response
    const habitWithUpdatedTags = await prisma.habit.findUnique({
        where: { id: params.habitId },
        include: { habitTags: { include: { tag: true } } }
    });
     if (!habitWithUpdatedTags) throw new Error("Failed to refetch habit after update.");


    const { habitTags: finalHabitTags, ...finalHabitData } = habitWithUpdatedTags;
    const responseData = {
      ...finalHabitData,
      tags: finalHabitTags.map(ht => ht.tag)
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error(`Error updating habit ${params.habitId}:`, error.message);
    if (error.message.includes('tag IDs for update are invalid')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
