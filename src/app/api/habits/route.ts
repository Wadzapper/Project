import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType, HabitGoalType } from '@prisma/client';

interface HabitInput {
  name: string;
  description?: string | null;
  type: HabitType;
  goalType: HabitGoalType;
  frequency: number;
  periodInDays?: number | null;
  tagIds?: string[]; // Changed from tags: string[] to tagIds: string[]
}

function validateHabitInput(data: any): { isValid: boolean; errors?: any; data?: HabitInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  if (!data.type || !Object.values(HabitType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid habit type.' } };
  }
  if (!data.goalType || !Object.values(HabitGoalType).includes(data.goalType)) {
    return { isValid: false, errors: { goalType: 'Invalid goal type.' } };
  }
  if (data.frequency === undefined || typeof data.frequency !== 'number' || data.frequency <= 0) {
    return { isValid: false, errors: { frequency: 'Frequency must be a positive number.'}};
  }
  if (data.goalType === HabitGoalType.TIMES_PER_PERIOD && (data.periodInDays === undefined || typeof data.periodInDays !== 'number' || data.periodInDays <= 0)) {
    return { isValid: false, errors: { periodInDays: 'Period (in days) is required for TIMES_PER_PERIOD goal type and must be positive.'}};
  }
  // Validate tagIds if provided
  if (data.tagIds !== undefined && (!Array.isArray(data.tagIds) || !data.tagIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { tagIds: 'tagIds must be an array of strings.' } };
  }
  return { isValid: true, data: data as HabitInput };
}

// GET /api/habits - Get all habits for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const archivedParam = searchParams.get('archived'); // "true" or "false"
  const typeParam = searchParams.get('type') as HabitType | null;

  const whereClause: any = { userId: session.user.id };
  if (archivedParam === 'true') {
    whereClause.archived = true;
  } else if (archivedParam === 'false') {
    whereClause.archived = false;
  } // If not specified, fetch all (both archived and not) or default to non-archived.
    // For now, let's default to fetching non-archived unless specified.
    else if (archivedParam === null) { // only apply if param is missing
        whereClause.archived = false;
    }


  if (typeParam && Object.values(HabitType).includes(typeParam)) {
    whereClause.type = typeParam;
  }

  try {
    const habitsFromDb = await prisma.habit.findMany({ // Renamed to avoid conflict
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      // Include all necessary fields directly. The streak/count fields are on the Habit model itself.
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        goalType: true,
        frequency: true,
        periodInDays: true,
        // tags: true, // This was the old string array field, will be removed from schema
        archived: true,
        createdAt: true,
        updatedAt: true,
        currentStreak: true,
        longestStreak: true,
        successCount: true,
        totalLogCount: true,
        lastLoggedDate: true,
        habitTags: { // Include linked tags
          select: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        },
        _count: { // For loggedToday
          select: {
            logs: {
              where: {
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
                isSuccess: true,
              },
            },
          },
        },
      },
    });

    const habitsWithStatusAndTags = habitsFromDb.map(habit => {
      let loggedToday = false;
      if (habit.goalType === HabitGoalType.DAILY) {
        loggedToday = habit._count.logs > 0;
      }
      const { _count, habitTags, ...habitData } = habit;
      return {
        ...habitData,
        loggedToday,
        tags: habitTags.map(ht => ht.tag) // Flatten to simple array of Tag objects
      };
    });

    return NextResponse.json(habitsWithStatusAndTags);
  } catch (error) {
    console.error('Error fetching habits:', error);
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
  }
}

// POST /api/habits - Create a new habit
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: HabitInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateHabitInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description, type, goalType, frequency, periodInDays, tagIds } = validation.data; // Use tagIds

  try {
    // Validate tagIds if provided
    if (tagIds && tagIds.length > 0) {
      const tagsExistCount = await prisma.tag.count({
        where: {
          id: { in: tagIds },
          userId: session.user.id, // Ensure tags belong to the user
        },
      });
      if (tagsExistCount !== tagIds.length) {
        return NextResponse.json({ error: 'One or more provided tag IDs are invalid or do not belong to the user.' }, { status: 400 });
      }
    }

    const newHabit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        type,
        goalType,
        frequency,
        periodInDays: goalType === HabitGoalType.TIMES_PER_PERIOD ? periodInDays : null,
        // tags: tags || [], // Old string array tags
        // Connect to tags via HabitTag join table
        habitTags: tagIds && tagIds.length > 0
          ? {
              create: tagIds.map(tagId => ({
                tagId: tagId,
                assignedBy: session.user.id!, // User assigning the tag
              })),
            }
          : undefined,
        currentStreak: 0,
        longestStreak: 0,
        successCount: 0,
        totalLogCount: 0,
        lastLoggedDate: null,
      },
    });
    return NextResponse.json(newHabit, { status: 201 });
  } catch (error) {
    console.error('Error creating habit:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
