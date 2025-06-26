import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';

type ValidRatingMetric = 'productivity' | 'mood' | 'energy' | 'stress' | 'focus';
const metricsToAverage: ValidRatingMetric[] = ['productivity', 'mood', 'energy', 'stress', 'focus'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y, all

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
    const aggregateOperations: any = {};
    metricsToAverage.forEach(metric => {
      aggregateOperations[`_avg${metric.charAt(0).toUpperCase() + metric.slice(1)}`] = { _avg: { [metric]: true } };
      // To also get counts for better averaging if some days have nulls for optional metrics:
      // aggregateOperations[`_count${metric.charAt(0).toUpperCase() + metric.slice(1)}`] = { _count: { [metric]: true } };
    });

    // Prisma doesn't directly support multiple _avg in one call in the way we might want for a radar chart structure.
    // We need to fetch relevant ratings and calculate averages in code, or do multiple aggregate calls.
    // For simplicity, let's fetch all ratings in the period and calculate averages.

    const ratingsInPeriod = await prisma.dailyRating.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: veryEndDate },
        },
        select: {
            productivity: true,
            mood: true,
            energy: true,
            stress: true,
            focus: true,
        }
    });

    const averageData: { metric: string, value: number }[] = [];

    if (ratingsInPeriod.length > 0) {
        metricsToAverage.forEach(metric => {
            let sum = 0;
            let count = 0;
            ratingsInPeriod.forEach(r => {
                const val = r[metric];
                if (val !== null && val !== undefined) {
                    sum += val;
                    count++;
                }
            });
            averageData.push({
                metric: metric.charAt(0).toUpperCase() + metric.slice(1), // Capitalize for display
                value: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0,
            });
        });
    } else {
         metricsToAverage.forEach(metric => {
            averageData.push({
                metric: metric.charAt(0).toUpperCase() + metric.slice(1),
                value: 0,
            });
        });
    }


    return NextResponse.json(averageData);

  } catch (error) {
    console.error('Error fetching rating averages:', error);
    return NextResponse.json({ error: 'Failed to fetch rating averages' }, { status: 500 });
  }
}
