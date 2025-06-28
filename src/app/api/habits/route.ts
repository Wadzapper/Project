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
  tags?: string[]; // Expecting string array for tags directly
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
  if (data.tags !== undefined && (!Array.isArray(data.tags) || !data.tags.every((tag: any) => typeof tag === 'string'))) {
    return { isValid: false, errors: { tags: 'tags must be an array of strings.' } };
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
  const archivedParam = searchParams.get('archived');
  const typeParam = searchParams.get('type') as HabitType | null;

  const whereClause: any = { userId: session.user.id };
  if (archivedParam === 'true') {
    whereClause.archived = true;
  } else if (archivedParam === 'false' || archivedParam === null) { // Default to non-archived if not specified or explicitly false
    whereClause.archived = false;
  }

  if (typeParam && Object.values(HabitType).includes(typeParam)) {
    whereClause.type = typeParam;
  }

  try {
    const habitsFromDb = await prisma.habit.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { // Include count of successful logs for today
        _count: {
          select: {
            logs: {
              where: {
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
                isSuccess: true, // Consider only successful logs for "loggedToday"
              },
            },
          },
        },
      },
    });

    // Add a 'loggedToday' field based on the count of successful logs for today
    const habitsWithLoggedToday = habitsFromDb.map(habit => {
      const { _count, ...habitData } = habit;
      return {
        ...habitData,
        loggedToday: (_count?.logs ?? 0) > 0,
        // tags are already part of habitData as String[]
      };
    });

    return NextResponse.json(habitsWithLoggedToday);
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

  const { name, description, type, goalType, frequency, periodInDays, tags } = validation.data;

  try {
    const newHabit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        type,
        goalType,
        frequency,
        periodInDays: goalType === HabitGoalType.TIMES_PER_PERIOD ? periodInDays : null,
        tags: tags || [], // Assign the string array directly
        // Fields like currentStreak, longestStreak, etc., are not on the model
        // and should be calculated or handled elsewhere if needed.
      },
    });
    return NextResponse.json(newHabit, { status: 201 });
  } catch (error) {
    console.error('Error creating habit:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
