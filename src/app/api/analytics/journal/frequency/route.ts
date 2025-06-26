import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, eachWeekOfInterval, format, eachMonthOfInterval, parseISO, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '90d'; // 30d, 90d, 1y, all
  const groupBy = searchParams.get('groupBy') || 'week'; // week, month

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case '1y': startDate = startOfDay(subDays(veryEndDate, 364)); break;
    case 'all':
      const firstEntry = await prisma.journalEntry.findFirst({
        where: { userId }, orderBy: { date: 'asc' }, select: { date: true }
      });
      startDate = firstEntry ? startOfDay(firstEntry.date) : startOfDay(subDays(veryEndDate, 89)); // Default to 90d if no entries
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 89)); // Default to 90 days
  }

  try {
    const entriesInPeriod = await prisma.journalEntry.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: veryEndDate },
      },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    const frequencyData = new Map<string, number>();
    let interval: Date[];
    let dateFormat: string;
    let displayFormat: (date: Date) => string;


    if (groupBy === 'week') {
      interval = eachWeekOfInterval({ start: startDate, end: veryEndDate }, { weekStartsOn: 1 });
      dateFormat = 'yyyy-ww'; // ISO week
      displayFormat = (d) => `Week ${format(d, 'w, yyyy')}`; // For more readable label
    } else { // month
      interval = eachMonthOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM';
      displayFormat = (d) => format(d, 'MMM yyyy');
    }

    // Initialize map for all intervals in the range
    interval.forEach(date => frequencyData.set(format(date, dateFormat), 0));

    entriesInPeriod.forEach(entry => {
      const key = format(entry.date, dateFormat);
      frequencyData.set(key, (frequencyData.get(key) || 0) + 1);
    });

    const chartData = Array.from(frequencyData.entries()).map(([periodKey, count]) => {
        // For display, convert periodKey (like '2023-01' or '2023-01') back to a representative date for the label
        let representativeDate;
        if (groupBy === 'week') {
            const [year, week] = periodKey.split('-').map(Number);
            representativeDate = startOfWeek(parseISO(`${year}-01-01`), { weekStartsOn: 1 });
            representativeDate.setDate(representativeDate.getDate() + (week -1) * 7);
        } else { // month
            representativeDate = parseISO(periodKey + '-01');
        }
        return {
            period: displayFormat(representativeDate),
            count
        };
    });
    // Sort by the actual date represented by the period key for correct chronological order
    chartData.sort((a,b) => {
        let dateA, dateB;
         if (groupBy === 'week') {
            const [yearA, weekA] = a.period.match(/Week (\d+), (\d+)/)!.slice(1).map(Number);
            dateA = startOfWeek(parseISO(`${yearA}-01-01`), { weekStartsOn: 1 });
            dateA.setDate(dateA.getDate() + (weekA -1) * 7);

            const [yearB, weekB] = b.period.match(/Week (\d+), (\d+)/)!.slice(1).map(Number);
            dateB = startOfWeek(parseISO(`${yearB}-01-01`), { weekStartsOn: 1 });
            dateB.setDate(dateB.getDate() + (weekB -1) * 7);
        } else { // month
            dateA = parseISO(a.period); // parse 'MMM yyyy'
            dateB = parseISO(b.period);
        }
        return dateA.getTime() - dateB.getTime();
    });


    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Error fetching journal entry frequency:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entry frequency' }, { status: 500 });
  }
}
