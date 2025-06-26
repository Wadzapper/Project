import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Habit, HabitGoalType, HabitType } from '@prisma/client';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, differenceInDays, formatISO, getISODay, eachWeekOfInterval, format, parseISO, startOfWeek, getISOWeek, getYear } from 'date-fns';

interface HabitWithLogs extends Habit {
    logs: { date: Date, count: number, isSuccess?: boolean | null }[];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const habitId = searchParams.get('habitId'); // Required for specific habit compliance
  const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d
  const groupBy = searchParams.get('groupBy') || 'day'; // day, week

  if (!habitId) {
    return NextResponse.json({ error: 'habitId is required' }, { status: 400 });
  }

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '7d': startDate = startOfDay(subDays(veryEndDate, 6)); break;
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    default: startDate = startOfDay(subDays(veryEndDate, 29));
  }

  try {
    const habit = await prisma.habit.findUnique({
      where: { id: habitId, userId },
      include: {
        logs: {
          where: { date: { gte: startDate, lte: veryEndDate } },
          orderBy: { date: 'asc' },
          select: { date: true, count: true, isSuccess: true }
        }
      }
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found or access denied' }, { status: 404 });
    }

    const complianceData = new Map<string, { logged: number, expected: number, successRate?: number }>();
    let interval: Date[];
    let dateFormat: string;
    let displayFormatFunc: (date: Date) => string;

    if (groupBy === 'day') {
      interval = eachDayOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM-dd';
      displayFormatFunc = (d) => format(d, 'MMM d');
    } else { // week
      interval = eachWeekOfInterval({ start: startDate, end: veryEndDate }, { weekStartsOn: 1 });
      dateFormat = 'yyyy-ww'; // ISO week
      displayFormatFunc = (d) => `Week ${format(d, 'w, yyyy')}`;
    }

    interval.forEach(date => complianceData.set(format(date, dateFormat), { logged: 0, expected: 0 }));

    // Calculate expected logs
    interval.forEach(intervalDate => {
        const key = format(intervalDate, dateFormat);
        let expectedForInterval = 0;
        if (habit.goalType === HabitGoalType.DAILY) {
            expectedForInterval = habit.frequency * (groupBy === 'day' ? 1 : 7); // 7 days in a week
        } else if (habit.goalType === HabitGoalType.WEEKLY && groupBy === 'week') {
            expectedForInterval = habit.frequency;
        } else if (habit.goalType === HabitGoalType.WEEKLY && groupBy === 'day') {
            // Distribute weekly frequency over days for daily grouping (approximate)
            // Or simply set expected per day if applicable for daily habits shown weekly.
            // For simplicity, if it's a weekly habit shown daily, expected is freq/7 per day.
            // This part can get complex. Let's assume daily habits are expected daily, weekly are expected weekly.
             if (habit.goalType === HabitGoalType.DAILY) expectedForInterval = habit.frequency;

        } else if (habit.goalType === HabitGoalType.TIMES_PER_PERIOD && habit.periodInDays) {
             // This is more complex if groupBy interval doesn't align with periodInDays
             // For simplicity, if groupBy is 'week' and periodInDays is 7, it's like WEEKLY.
             if (groupBy === 'week' && habit.periodInDays === 7) expectedForInterval = habit.frequency;
             // If groupBy is 'day', it's harder to set a daily expectation for "X times per 7 days"
             // For now, only handle DAILY and WEEKLY accurately for 'day' and 'week' groupBy.
        }

        const currentEntry = complianceData.get(key);
        if (currentEntry) {
            currentEntry.expected = expectedForInterval;
        }
    });

    // Sum logged counts
    habit.logs.forEach(log => {
      const key = format(log.date, dateFormat);
      const entry = complianceData.get(key);
      if (entry) {
        if (habit.type === HabitType.GOOD) {
            entry.logged += log.count;
        } else if (habit.type === HabitType.BAD && log.isSuccess === false) { // isSuccess=false means indulged
            entry.logged += log.count; // 'logged' here means occurrences of bad habit
        } else if (habit.type === HabitType.BAD && log.isSuccess === true) {
            // This log means successfully avoided. For compliance chart, this might be counted differently.
            // For now, 'logged' means 'done' for good, or 'indulged' for bad.
        }
      }
    });

    const chartData = Array.from(complianceData.entries()).map(([periodKey, data]) => {
        let representativeDate;
        if (groupBy === 'week') {
            const [year, week] = periodKey.split('-').map(Number);
            representativeDate = startOfWeek(parseISO(`${year}-01-01`), { weekStartsOn: 1 });
            representativeDate.setDate(representativeDate.getDate() + (week -1) * 7);
        } else {
            representativeDate = parseISO(periodKey);
        }
      return {
        periodLabel: displayFormatFunc(representativeDate),
        logged: data.logged,
        expected: data.expected, // Expected 'good' actions or allowed 'bad' actions
        // Success rate for GOOD habits: (logged / expected) * 100
        // Success rate for BAD habits (avoidance): ((expected - logged) / expected) * 100 if expected is a limit
        // Or just show logged vs expected.
        successRate: data.expected > 0 ? (habit.type === HabitType.GOOD ? (data.logged / data.expected) : ((data.expected - data.logged)/data.expected) ) * 100 : (data.logged > 0 ? 0 : 100)
      };
    });

    chartData.sort((a,b) => { /* ... same sorting as journal frequency ... */
        let dateA, dateB;
         if (groupBy === 'week') {
            const matchA = a.periodLabel.match(/Week (\d+), (\d+)/);
            const matchB = b.periodLabel.match(/Week (\d+), (\d+)/);
            if (!matchA || !matchB) return 0;
            const [wA, yA] = matchA.slice(1).map(Number);
            const [wB, yB] = matchB.slice(1).map(Number);
            dateA = startOfWeek(parseISO(`${yA}-01-01`),{weekStartsOn:1}); dateA.setDate(dateA.getDate()+(wA-1)*7);
            dateB = startOfWeek(parseISO(`${yB}-01-01`),{weekStartsOn:1}); dateB.setDate(dateB.getDate()+(wB-1)*7);
        } else {
            dateA = parseISO(a.periodLabel);
            dateB = parseISO(b.periodLabel);
        }
        return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({ habitName: habit.name, habitType: habit.type, data: chartData });

  } catch (error) {
    console.error('Error fetching habit compliance data:', error);
    return NextResponse.json({ error: 'Failed to fetch habit compliance data' }, { status: 500 });
  }
}
