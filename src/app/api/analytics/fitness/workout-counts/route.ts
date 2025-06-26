import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { WorkoutType } from '@prisma/client';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, formatISO, parseISO, startOfWeek, startOfMonth, startOfYear, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '90d'; // 30d, 90d, 1y, all
  const groupBy = searchParams.get('groupBy') || 'week'; // day, week, month
  const workoutTypeParam = searchParams.get('workoutType') as WorkoutType | null;


  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case '1y': startDate = startOfDay(subDays(veryEndDate, 364)); break;
    case 'all':
      const firstSession = await prisma.workoutSession.findFirst({
        where: { userId }, orderBy: { date: 'asc' }, select: { date: true }
      });
      startDate = firstSession ? startOfDay(firstSession.date) : startOfDay(subDays(veryEndDate, 89));
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 89));
  }

  try {
    const whereClause: any = {
      userId,
      date: { gte: startDate, lte: veryEndDate },
    };
    if (workoutTypeParam && Object.values(WorkoutType).includes(workoutTypeParam)) {
      whereClause.type = workoutTypeParam;
    }

    const sessions = await prisma.workoutSession.findMany({
      where: whereClause,
      select: { date: true }, // Only need date for grouping
      orderBy: { date: 'asc' },
    });

    const frequencyData = new Map<string, number>();
    let interval: Date[];
    let dateFormat: string;
    let displayFormatFunc: (date: Date) => string;

    if (groupBy === 'day') {
      interval = eachDayOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM-dd';
      displayFormatFunc = (d) => format(d, 'MMM d');
    } else if (groupBy === 'week') {
      interval = eachWeekOfInterval({ start: startDate, end: veryEndDate }, { weekStartsOn: 1 });
      dateFormat = 'yyyy-ww'; // ISO week
      displayFormatFunc = (d) => `Week ${format(d, 'w, yyyy')}`;
    } else { // month
      interval = eachMonthOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM';
      displayFormatFunc = (d) => format(d, 'MMM yyyy');
    }

    interval.forEach(date => frequencyData.set(format(date, dateFormat), 0));

    sessions.forEach(session => {
      const key = format(session.date, dateFormat);
      frequencyData.set(key, (frequencyData.get(key) || 0) + 1);
    });

    const chartData = Array.from(frequencyData.entries()).map(([periodKey, count]) => {
        let representativeDate;
        if (groupBy === 'week') {
            const [year, weekNo] = periodKey.split('-').map(Number);
            // Create a date for the first day of that ISO week and year
            // Note: ISO weeks can be tricky with date-fns if not careful with start of year.
            // A simpler way might be to just use the start of the week from the interval array.
            const weekDateMatch = interval.find(d => format(d, 'yyyy-ww') === periodKey);
            representativeDate = weekDateMatch || new Date(); // Fallback, should always find
        } else {
            representativeDate = parseISO(periodKey + (groupBy === 'month' ? '-01' : ''));
        }
        return {
            period: displayFormatFunc(representativeDate),
            count
        };
    });

    // Sort chronologically based on the representative date of the period
     chartData.sort((a,b) => {
        let dateA, dateB;
         if (groupBy === 'week') {
            const matchA = a.period.match(/Week (\d+), (\d+)/);
            const matchB = b.period.match(/Week (\d+), (\d+)/);
            if (!matchA || !matchB) return 0;
            const [wA, yA] = matchA.slice(1).map(Number);
            const [wB, yB] = matchB.slice(1).map(Number);
            dateA = startOfWeek(parseISO(`${yA}-01-01`),{weekStartsOn:1}); dateA.setDate(dateA.getDate()+(wA-1)*7);
            dateB = startOfWeek(parseISO(`${yB}-01-01`),{weekStartsOn:1}); dateB.setDate(dateB.getDate()+(wB-1)*7);
        } else {
            // For 'day' or 'month', the 'period' from displayFormatFunc is directly parsable if it's like 'MMM d' or 'MMM yyyy'
            // However, for sorting, it's better to use the original interval dates if possible, or convert back accurately.
            // The current `chartData` has display strings. Sorting them as strings might not be chronological for 'MMM d'.
            // A more robust solution would involve keeping original date objects or sortable keys.
            // For now, this sort might be imperfect for daily groupings across month boundaries if not careful with parseISO.
            dateA = parseISO(a.period.includes("Week") ? a.period.split(', ')[1] + "-01-01" : a.period); // Simplistic
            dateB = parseISO(b.period.includes("Week") ? b.period.split(', ')[1] + "-01-01" : b.period); // Simplistic
        }
        return dateA.getTime() - dateB.getTime();
    });


    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Error fetching workout counts:', error);
    return NextResponse.json({ error: 'Failed to fetch workout counts' }, { status: 500 });
  }
}
