import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Assuming auth setup
import { prisma } from '@/lib/db'; // Assuming prisma client setup
import { HabitGoalType } from '@prisma/client';
import { addDays, format, isSameDay, subDays, startOfDay } from 'date-fns';

interface AnalyticsData {
  date: string; // 'YYYY-MM-DD'
  logged: boolean; // Whether a successful log exists for that day
  streak: number; // Running streak as of that day
}

export async function GET(
  req: NextRequest,
  { params }: { params: { habitId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { habitId } = params;

  if (!habitId || typeof habitId !== 'string') {
    return NextResponse.json({ error: 'Habit ID is required.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get('range');
  const range = rangeParam ? parseInt(rangeParam) : 60; // Default to 60 days

  if (isNaN(range) || range <= 0) {
    return NextResponse.json({ error: 'Invalid range parameter. Must be a positive number.' }, { status: 400 });
  }

  try {
    // 1. Fetch the habit and validate ownership & type
    const habit = await prisma.habit.findUnique({
      where: { id: habitId },
    });

    if (!habit || habit.userId !== userId) {
      return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });
    }

    // 2. Define date range for analytics
    const today = startOfDay(new Date()); // Use startOfDay for consistency
    const startDate = startOfDay(subDays(today, range - 1)); // -1 because range includes today

    // 3. Fetch all successful logs for this habit within the date range
    // We only care about successful logs for calculating 'logged: true' and streaks for DAILY habits
    const logs = await prisma.habitLog.findMany({
      where: {
        habitId: habit.id,
        isSuccess: true, // Only successful logs contribute to positive status and streak
        date: {
          gte: startDate,
          lte: today, // Ensure logs are up to and including today
        },
      },
      select: {
        date: true,
      },
      orderBy: {
        date: 'asc', // Order by date for easier processing
      },
    });

    // 4. Normalize successful log dates for quick lookup
    const successfulLogDates = new Set(
      logs.map(log => format(new Date(log.date), 'yyyy-MM-dd'))
    );

    // 5. Build the streak series
    const results: AnalyticsData[] = [];
    let currentStreak = 0;

    for (let i = 0; i < range; i++) {
      const currentDate = startOfDay(addDays(startDate, i));
      const dateString = format(currentDate, 'yyyy-MM-dd');

      const wasLoggedSuccessfully = successfulLogDates.has(dateString);

      if (habit.goalType === HabitGoalType.DAILY) {
        if (wasLoggedSuccessfully) {
          currentStreak++;
        } else {
          // If not logged successfully, streak breaks for DAILY habits.
          // This also handles cases where a log might exist but isSuccess is false/null,
          // because we only fetched isSuccess: true logs.
          currentStreak = 0;
        }
      } else {
        // For non-DAILY habits, streak calculation is more complex and not handled in this MVP.
        // We can report logged status but streak might remain 0 or be handled differently.
        // For now, let's assume streak is not applicable or always 0 for non-DAILY for this endpoint.
        currentStreak = 0; // Or some other logic for non-daily streaks if defined
      }

      results.push({
        date: dateString,
        logged: wasLoggedSuccessfully, // Based on successful logs
        streak: currentStreak,
      });
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error(`Error fetching analytics for habit ${habitId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch habit analytics' }, { status: 500 });
  }
}
