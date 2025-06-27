// Summary: API endpoint for weekly habit and quest completion analytics.
// Fetches data for the current week and the past two full weeks.
// TODO: Consider timezone handling more deeply if users are distributed. Defaulting to server/DB timezone for now.
// TODO: Optimize queries if performance becomes an issue with very large log tables.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus } from '@prisma/client';
import { startOfWeek, endOfWeek, subWeeks, eachDayOfInterval, format, getISODay, parseISO } from 'date-fns';

interface WeekAnalytics {
  weekStart: string; // YYYY-MM-DD, Monday of that week
  counts: number[]; // 7 numbers, representing Mon, Tue, Wed, Thu, Fri, Sat, Sun
}

interface WeeklyAnalyticsResponse {
  habits: WeekAnalytics[];
  quests: WeekAnalytics[];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const weeksToAnalyze: Date[] = [];
    const today = new Date();

    // Define the weeks: current week, last week, week before last
    // date-fns startOfWeek default is Sunday if locale not specified, use { weekStartsOn: 1 } for Monday
    weeksToAnalyze.push(startOfWeek(today, { weekStartsOn: 1 }));
    weeksToAnalyze.push(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }));
    weeksToAnalyze.push(startOfWeek(subWeeks(today, 2), { weekStartsOn: 1 }));

    const habitAnalytics: WeekAnalytics[] = [];
    const questAnalytics: WeekAnalytics[] = [];

    for (const weekStartDate of weeksToAnalyze) {
      const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
      const weekStartString = format(weekStartDate, 'yyyy-MM-dd');

      // Habit Completions for the week
      const habitLogsInWeek = await prisma.habitLog.findMany({
        where: {
          userId: userId,
          isSuccess: true, // Only count successful completions
          date: {
            gte: weekStartDate,
            lte: weekEndDate,
          },
        },
        select: {
          date: true,
        },
      });

      const habitCountsByDay = Array(7).fill(0); // Mon (0) to Sun (6)
      for (const log of habitLogsInWeek) {
        const dayOfWeek = getISODay(log.date); // 1 (Mon) to 7 (Sun)
        habitCountsByDay[dayOfWeek - 1]++;
      }
      habitAnalytics.push({ weekStart: weekStartString, counts: habitCountsByDay });

      // Quest Completions for the week
      // We look at QuestLog for status changes to COMPLETED, or Quest model's completedAt field.
      // Using Quest model's completedAt is simpler if it's reliably set.
      const completedQuestsInWeek = await prisma.quest.findMany({
        where: {
          userId: userId,
          status: QuestStatus.COMPLETED,
          completedAt: {
            gte: weekStartDate,
            lte: weekEndDate,
          },
        },
        select: {
          completedAt: true,
        },
      });

      const questCountsByDay = Array(7).fill(0); // Mon (0) to Sun (6)
      for (const quest of completedQuestsInWeek) {
        if (quest.completedAt) {
          const dayOfWeek = getISODay(quest.completedAt); // 1 (Mon) to 7 (Sun)
          questCountsByDay[dayOfWeek - 1]++;
        }
      }
      questAnalytics.push({ weekStart: weekStartString, counts: questCountsByDay });
    }

    const responseData: WeeklyAnalyticsResponse = {
      habits: habitAnalytics.sort((a,b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()), // Most recent week first
      quests: questAnalytics.sort((a,b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()), // Most recent week first
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching weekly analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly analytics' }, { status: 500 });
  }
}
