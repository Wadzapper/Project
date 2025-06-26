import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const totalHabits = await prisma.habit.count({
      where: { userId, archived: false },
    });

    const goodHabitsCount = await prisma.habit.count({
      where: { userId, archived: false, type: HabitType.GOOD },
    });

    const badHabitsCount = await prisma.habit.count({
      where: { userId, archived: false, type: HabitType.BAD },
    });

    const totalHabitLogs = await prisma.habitLog.count({
      where: { userId },
    });

    // Most frequently logged habit (good and bad) could be complex, defer for detailed views
    // Current streaks are also complex, defer to specific habit endpoint or habit list view logic

    return NextResponse.json({
      totalHabits,
      goodHabitsCount,
      badHabitsCount,
      totalHabitLogsToday: await prisma.habitLog.count({ // Example of a more specific stat
          where: {
              userId,
              date: {
                  gte: new Date(new Date().setHours(0,0,0,0)),
                  lt: new Date(new Date().setHours(23,59,59,999))
              }
          }
      }),
    });

  } catch (error) {
    console.error('Error fetching habits summary:', error);
    return NextResponse.json({ error: 'Failed to fetch habits summary' }, { status: 500 });
  }
}
