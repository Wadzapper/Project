import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { WorkoutType } from '@prisma/client';

// Re-using input types from the other workout route for PATCH body
interface SetInput {
  id?: string; // For updating existing sets
  reps: number;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
  setNumber: number;
}

interface ExerciseInput {
  id?: string; // For updating existing exercises
  name: string;
  notes?: string | null;
  sets: SetInput[];
  durationMinutes?: number | null;
  distanceKm?: number | null;
  caloriesBurned?: number | null;
  order?: number;
}

interface WorkoutSessionUpdateInput {
  date?: string; // ISO DateTime string
  type?: WorkoutType;
  notes?: string | null;
  exercises?: ExerciseInput[]; // If provided, will replace existing exercises and sets
}

// Basic validation - can be replaced/enhanced with Zod later
function validateWorkoutSessionUpdateInput(data: any): { isValid: boolean; errors?: any; data?: WorkoutSessionUpdateInput } {
  if (data.date && isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required if provided.' } };
  }
  if (data.type && !Object.values(WorkoutType).includes(data.type as WorkoutType)) {
    return { isValid: false, errors: { type: 'Invalid workout type if provided.' } };
  }
  if (data.exercises && (!Array.isArray(data.exercises) || data.exercises.length === 0)) {
    return { isValid: false, errors: { exercises: 'If exercises are provided, array cannot be empty.' } };
  }
  if (data.exercises) {
    for (const ex of data.exercises) {
      if (!ex.name || typeof ex.name !== 'string' || ex.name.trim().length === 0) {
        return { isValid: false, errors: { exercises: 'Exercise name is required.' } };
      }
      if (ex.sets) { // sets are optional per exercise if it's cardio focused
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
  }
  return { isValid: true, data: data as WorkoutSessionUpdateInput };
}


// GET /api/workouts/[sessionId]
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: params.sessionId, userId: session.user.id },
      include: {
        exerciseLogs: {
          orderBy: { order: 'asc' },
          include: { sets: { orderBy: { setNumber: 'asc' } } }
        }
      },
    });
    if (!workoutSession) return NextResponse.json({ error: 'Workout session not found' }, { status: 404 });
    return NextResponse.json(workoutSession);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch workout session' }, { status: 500 });
  }
}

// PATCH /api/workouts/[sessionId]
export async function PATCH(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: WorkoutSessionUpdateInput;
  try { body = await req.json(); }
  catch (e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validation = validateWorkoutSessionUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  const { date, type, notes, exercises } = validation.data;

  try {
    const existingSession = await prisma.workoutSession.findUnique({
        where: { id: params.sessionId, userId: session.user.id }
    });
    if (!existingSession) return NextResponse.json({ error: 'Workout session not found or access denied' }, { status: 404 });

    const updatedSession = await prisma.$transaction(async (tx) => {
      // Update session-level fields
      const sessionUpdateData: any = {};
      if (date) sessionUpdateData.date = new Date(date);
      if (type) sessionUpdateData.type = type;
      if (notes !== undefined) sessionUpdateData.notes = notes;

      let finalSession = await tx.workoutSession.update({
        where: { id: params.sessionId },
        data: sessionUpdateData,
        include: { exerciseLogs: { include: { sets: true } } } // Keep this structure for return
      });

      // If exercises are provided, this means a full replacement of exercises and their sets for this session
      if (exercises) {
        // Delete existing exercise logs (and their sets due to cascading)
        await tx.exerciseEntry.deleteMany({ where: { sessionId: params.sessionId } });

        // Create new exercise logs and sets
        if (exercises.length > 0) {
            const createdExercises = [];
            for (let i = 0; i < exercises.length; i++) {
                const exInput = exercises[i];
                const createdEx = await tx.exerciseEntry.create({
                    data: {
                        sessionId: params.sessionId,
                        name: exInput.name,
                        notes: exInput.notes,
                        durationMinutes: exInput.durationMinutes,
                        distanceKm: exInput.distanceKm,
                        caloriesBurned: exInput.caloriesBurned,
                        order: exInput.order ?? i,
                        sets: {
                            create: exInput.sets.map(setInput => ({
                                setNumber: setInput.setNumber,
                                reps: setInput.reps,
                                weightKg: setInput.weightKg,
                                restSeconds: setInput.restSeconds,
                                notes: setInput.notes,
                            }))
                        }
                    },
                    include: { sets: true }
                });
                createdExercises.push(createdEx);
            }
             // Re-fetch the session to get the updated nested structure
            finalSession = (await tx.workoutSession.findUnique({
                where: { id: params.sessionId },
                include: { exerciseLogs: { orderBy: {order: 'asc'}, include: { sets: {orderBy: {setNumber: 'asc'}} } } }
            }))!;
        } else {
             finalSession.exerciseLogs = []; // Ensure it's an empty array if all exercises were removed
        }
      }
      return finalSession;
    });

    return NextResponse.json(updatedSession);
  } catch (error: any) {
    console.error(`Error updating workout session ${params.sessionId}:`, error);
    return NextResponse.json({ error: 'Failed to update workout session', details: error.message }, { status: 500 });
  }
}

// DELETE /api/workouts/[sessionId]
export async function DELETE(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const existingSession = await prisma.workoutSession.findUnique({ where: { id: params.sessionId, userId: session.user.id }});
    if (!existingSession) return NextResponse.json({ error: 'Workout session not found or access denied' }, { status: 404 });

    // Cascading delete should handle ExerciseEntry and SetLog due to schema relations
    await prisma.workoutSession.delete({ where: { id: params.sessionId } });
    return NextResponse.json({ message: 'Workout session deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete workout session' }, { status: 500 });
  }
}
