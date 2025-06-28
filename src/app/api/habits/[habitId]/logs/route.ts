import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType, HabitGoalType } from '@prisma/client'; // Added HabitGoalType

interface HabitLogInput {
  date?: string;
  note?: string | null;
  isSuccess?: boolean | null;
  count?: number;
}

function validateHabitLogInput(data: any): { isValid: boolean; errors?: any; data?: HabitLogInput } {
  if (data.date && isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Invalid date format.' } };
  }
  // Default date to today if not provided or invalid
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    data.date = new Date().toISOString().split('T')[0];
  } else {
    data.date = new Date(data.date).toISOString().split('T')[0]; // Normalize to YYYY-MM-DD
  }

  if (data.count !== undefined && (typeof data.count !== 'number' || data.count <= 0)) {
    return { isValid: false, errors: { count: 'Count must be a positive number if provided.' } };
  }
  if (data.isSuccess !== undefined && data.isSuccess !== null && typeof data.isSuccess !== 'boolean') {
    return { isValid: false, errors: { isSuccess: 'isSuccess must be a boolean or null.' } };
  }
  return { isValid: true, data: data as HabitLogInput };
}

// Helper function to check if two dates are consecutive days
function areDatesConsecutive(date1: Date, date2: Date): boolean {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const diffDays = Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
    return diffDays === 1 && date1 > date2; // date1 must be the day after date2
}
// Helper to check if a date is today
function isToday(someDate: Date): boolean {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
           someDate.getMonth() === today.getMonth() &&
           someDate.getFullYear() === today.getFullYear();
}


export async function POST(
  req: NextRequest,
  { params }: { params: { habitId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { habitId } = params;

  let body: HabitLogInput;
  try {
    body = await req.json();
  } catch (error) {
    body = { date: new Date().toISOString().split('T')[0] }; // Default to today if no body
  }

  const validation = validateHabitLogInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { date: logDateString, note, isSuccess, count = 1 } = validation.data;
  const logDate = new Date(logDateString as string); // Already validated and normalized

  try {
    const habit = await prisma.habit.findUnique({
      where: { id: habitId, userId: userId },
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });
    }

    // Determine finalIsSuccess based on habit type and input
    let finalIsSuccess = isSuccess;
    if (habit.type === HabitType.GOOD) {
      finalIsSuccess = isSuccess === null || isSuccess === undefined ? true : isSuccess;
    } else { // BAD habit
      finalIsSuccess = isSuccess === null || isSuccess === undefined ? false : isSuccess; // For BAD habit, isSuccess=true means avoided (good outcome)
    }

    // Check for existing log for this habit on this specific day
    const existingLogToday = await prisma.habitLog.findFirst({
        where: {
            habitId: habitId,
            userId: userId,
            date: {
                gte: new Date(logDate.setHours(0, 0, 0, 0)),
                lt: new Date(logDate.setHours(23, 59, 59, 999)),
            }
        }
    });

    if (existingLogToday) {
        return NextResponse.json({ error: 'Habit already logged for this date.' }, { status: 409 });
    }


    // Transaction to create log and update habit stats
    const [newLog, updatedHabit] = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.habitLog.create({
        data: {
          habitId,
          userId,
          date: logDate,
          note: note || null,
          isSuccess: finalIsSuccess,
          count: count,
        },
      });

      // --- Streak and Stats Update Logic (Commented out for build fix) ---
      // TODO: Implement robust streak and habit statistics calculation.
      // This requires adding fields like currentStreak, longestStreak, lastLoggedDate,
      // successCount, totalLogCount to the Habit model in schema.prisma or calculating them dynamically.

      // let newCurrentStreak = (habit as any).currentStreak || 0;
      // let newLongestStreak = (habit as any).longestStreak || 0;
      // let newSuccessCount = (habit as any).successCount || 0;
      // let newTotalLogCount = ((habit as any).totalLogCount || 0) + 1;

      // if (finalIsSuccess) {
      //   newSuccessCount += 1;
      //   if ((habit as any).lastLoggedDate) {
      //     const lastLogDate = new Date((habit as any).lastLoggedDate);
      //     if (habit.goalType === HabitGoalType.DAILY && areDatesConsecutive(logDate, lastLogDate)) {
      //       newCurrentStreak += 1;
      //     } else {
      //       newCurrentStreak = 1;
      //     }
      //   } else {
      //     newCurrentStreak = 1;
      //   }
      // } else {
      //   newCurrentStreak = 0;
      // }

      // if (newCurrentStreak > newLongestStreak) {
      //   newLongestStreak = newCurrentStreak;
      // }

      // const habitUpdateData = {
      //   currentStreak: newCurrentStreak,
      //   longestStreak: newLongestStreak,
      //   lastLoggedDate: logDate,
      //   successCount: newSuccessCount,
      //   totalLogCount: newTotalLogCount,
      // };

      // For now, we are not updating the Habit model with these stats
      // const updatedHabitRecord = await tx.habit.update({
      //   where: { id: habitId },
      //   data: { updatedAt: new Date() }, // Just update 'updatedAt' or specific fields if needed
      // });
      // --- End of Commented out Streak Logic ---

      // Return the created log and the original habit data (or minimally updated habit)
      // Since we are not updating stats on the habit model for now, we can just return the original habit.
      // If you add a 'lastLoggedDate' to the Habit model, you could update that here.
      const minimallyUpdatedHabit = await tx.habit.update({
          where: { id: habitId },
          data: { updatedAt: new Date() } // Example: just touch updatedAt
      });


      return [createdLog, minimallyUpdatedHabit];
    });

    return NextResponse.json({ log: newLog, habit: updatedHabit }, { status: 201 });

  } catch (error: any) {
    console.error(`Error logging habit instance for habit ${habitId}:`, error);
    if (error.code === 'P2002') { // Unique constraint violation (e.g. if a unique index was on habitId+date)
        return NextResponse.json({ error: 'Habit already logged for this date.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to log habit instance', details: error.message }, { status: 500 });
  }
}
