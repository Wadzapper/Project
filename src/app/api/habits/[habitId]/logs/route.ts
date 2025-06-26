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

      // Simplified streak and stats update logic
      let newCurrentStreak = habit.currentStreak || 0;
      let newLongestStreak = habit.longestStreak || 0;
      let newSuccessCount = habit.successCount || 0;
      let newTotalLogCount = (habit.totalLogCount || 0) + 1;

      if (finalIsSuccess) {
        newSuccessCount += 1;
        if (habit.lastLoggedDate) {
          const lastLogDate = new Date(habit.lastLoggedDate);
          // For DAILY habits, check if consecutive. Other types need more complex logic.
          if (habit.goalType === HabitGoalType.DAILY && areDatesConsecutive(logDate, lastLogDate)) {
            newCurrentStreak += 1;
          } else if (habit.goalType === HabitGoalType.DAILY && isToday(logDate) && isToday(lastLogDate)) {
            // Logged multiple times today successfully, streak doesn't change from previous day's logic
            // Or, if it's the first log of today but not consecutive to yesterday, streak remains same as it was.
            // This logic still needs refinement for perfect streak counting with missed days.
          }
           else { // Streak broken or first log
            newCurrentStreak = 1;
          }
        } else { // First successful log
          newCurrentStreak = 1;
        }
      } else { // Log was not a success (e.g., failed a BAD habit, or marked GOOD habit as failed)
        newCurrentStreak = 0; // Reset streak on failure
      }

      if (newCurrentStreak > newLongestStreak) {
        newLongestStreak = newCurrentStreak;
      }

      const habitUpdateData = {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastLoggedDate: logDate, // Could be today or a past date from input
        successCount: newSuccessCount,
        totalLogCount: newTotalLogCount,
      };

      const updatedHabitRecord = await tx.habit.update({
        where: { id: habitId },
        data: habitUpdateData,
      });

      return [createdLog, updatedHabitRecord];
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
