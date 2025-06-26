import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, formatISO, parseISO } from 'date-fns';

// Define valid metric keys from DailyRating model
type ValidRatingMetric = 'productivity' | 'mood' | 'energy' | 'stress' | 'focus';
const validMetrics: ValidRatingMetric[] = ['productivity', 'mood', 'energy', 'stress', 'focus'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get('metric') as ValidRatingMetric | null;
  const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y, all

  if (!metric || !validMetrics.includes(metric)) {
    return NextResponse.json({ error: `Invalid or missing metric. Valid metrics are: ${validMetrics.join(', ')}` }, { status: 400 });
  }

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '7d': startDate = startOfDay(subDays(veryEndDate, 6)); break;
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case '1y': startDate = startOfDay(subDays(veryEndDate, 364)); break;
    case 'all':
      const firstRating = await prisma.dailyRating.findFirst({
        where: { userId }, orderBy: { date: 'asc' }, select: { date: true }
      });
      startDate = firstRating ? startOfDay(firstRating.date) : startOfDay(subDays(veryEndDate, 29));
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 29));
  }

  try {
    const ratings = await prisma.dailyRating.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: veryEndDate },
        [metric]: { not: null }, // Only include ratings where the metric is set
      },
      select: { date: true, [metric]: true },
      orderBy: { date: 'asc' },
    });

    const intervalDays = eachDayOfInterval({ start: startDate, end: veryEndDate });
    const ratingsMap = new Map(ratings.map(r => [formatISO(r.date, { representation: 'date' }), r[metric] as number | null]));

    const chartData = intervalDays.map(dayObj => {
      const dayKey = formatISO(dayObj, { representation: 'date' });
      return {
        date: dayKey,
        value: ratingsMap.get(dayKey) ?? null, // Use null for days with no rating for the metric
      };
    });

    return NextResponse.json(chartData);

  } catch (error) {
    console.error(`Error fetching rating trends for metric ${metric}:`, error);
    return NextResponse.json({ error: `Failed to fetch rating trends for ${metric}` }, { status: 500 });
  }
}
