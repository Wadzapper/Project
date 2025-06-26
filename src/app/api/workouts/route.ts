import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { WorkoutType } from '@prisma/client';

interface SetInput {
  reps: number;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
  setNumber: number;
}

interface ExerciseInput {
  name: string;
  notes?: string | null;
  sets: SetInput[];
  durationMinutes?: number | null;
  distanceKm?: number | null;
  caloriesBurned?: number | null;
  order?: number;
}

interface WorkoutSessionInput {
  date: string; // ISO DateTime string
  type: WorkoutType;
  notes?: string | null;
  exercises: ExerciseInput[];
}

// Basic validation - can be replaced/enhanced with Zod later
function validateWorkoutSessionInput(data: any): { isValid: boolean; errors?: any; data?: WorkoutSessionInput } {
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required.' } };
  }
  if (!data.type || !Object.values(WorkoutType).includes(data.type as WorkoutType)) {
    return { isValid: false, errors: { type: 'Invalid workout type.' } };
  }
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
    return { isValid: false, errors: { exercises: 'At least one exercise is required.' } };
  }
  for (const ex of data.exercises) {
    if (!ex.name || typeof ex.name !== 'string' || ex.name.trim().length === 0) {
      return { isValid: false, errors: { exercises: 'Exercise name is required.' } };
    }
    if (!Array.isArray(ex.sets) && (ex.type === WorkoutType.STRENGTH || ex.type === WorkoutType.MIXED) && ex.sets.length === 0 && !ex.durationMinutes && !ex.distanceKm) {
       // For strength/mixed, if no sets, then duration or distance should be present. This rule is a bit complex for basic validation.
       // For now, just ensure sets is an array if present.
    }
    if (ex.sets) {
        for (const set of ex.sets) {
            if (set.reps === undefined || typeof set.reps !== 'number' || set.reps < 0) {
                 return { isValid: false, errors: { exercises: `Invalid reps for exercise ${ex.name}.` } };
            }
            if (set.setNumber === undefined || typeof set.setNumber !== 'number' || set.setNumber < 0) {
                return { isValid: false, errors: { exercises: `Set number is required for exercise ${ex.name}.` } };
            }
        }
    }
  }
  return { isValid: true, data: data as WorkoutSessionInput };
}


// GET /api/workouts - Fetch all workout sessions for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = (page - 1) * limit;

  try {
    const workoutSessions = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: {
        exerciseLogs: {
          include: {
            sets: true,
          },
          orderBy: { order: 'asc' }, // Order exercises if 'order' field is used
        },
      },
      orderBy: { date: 'desc' },
      skip: offset,
      take: limit,
    });

    const totalSessions = await prisma.workoutSession.count({ where: { userId: session.user.id } });
    const totalPages = Math.ceil(totalSessions / limit);

    return NextResponse.json({
      sessions: workoutSessions,
      currentPage: page,
      totalPages,
      totalSessions,
    });
  } catch (error) {
    console.error('Error fetching workout sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch workout sessions' }, { status: 500 });
  }
}


// POST /api/workouts - Create a new workout session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: WorkoutSessionInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateWorkoutSessionInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { date, type, notes, exercises } = validation.data;

  try {
    const newWorkoutSession = await prisma.workoutSession.create({
      data: {
        userId: session.user.id,
        date: new Date(date),
        type,
        notes,
        exerciseLogs: {
          create: exercises.map((ex, index) => ({
            name: ex.name,
            notes: ex.notes,
            durationMinutes: ex.durationMinutes,
            distanceKm: ex.distanceKm,
            caloriesBurned: ex.caloriesBurned,
            order: ex.order ?? index, // Default order if not provided
            sets: {
              create: ex.sets.map(set => ({
                setNumber: set.setNumber,
                reps: set.reps,
                weightKg: set.weightKg,
                restSeconds: set.restSeconds,
                notes: set.notes,
              })),
            },
          })),
        },
      },
      include: { // Include nested data in the response
        exerciseLogs: {
          include: {
            sets: true,
          },
        },
      },
    });
    return NextResponse.json(newWorkoutSession, { status: 201 });
  } catch (error: any) {
    console.error('Error creating workout session:', error);
     if (error.code === 'P2002' || error.message.includes("Unique constraint failed")) { // More generic check
      return NextResponse.json({ error: 'A workout session with similar identifying fields already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create workout session', details: error.message }, { status: 500 });
  }
}
