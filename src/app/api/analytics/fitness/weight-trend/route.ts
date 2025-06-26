import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, formatISO, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '90d'; // 30d, 90d, 1y, all

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case '1y': startDate = startOfDay(subDays(veryEndDate, 364)); break;
    case 'all':
      const firstMetric = await prisma.bodyMetric.findFirst({
        where: { userId, weightKg: { not: null } }, // Ensure there's a weight to make it relevant
        orderBy: { date: 'asc' },
        select: { date: true }
      });
      startDate = firstMetric ? startOfDay(firstMetric.date) : startOfDay(subDays(veryEndDate, 89));
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 89)); // Default to 90 days
  }

  try {
    const metrics = await prisma.bodyMetric.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: veryEndDate },
        weightKg: { not: null }, // Only fetch entries where weight is logged
      },
      select: { date: true, weightKg: true },
      orderBy: { date: 'asc' },
    });

    // For a line chart, we often want one point per day, even if no metric was logged.
    // This requires filling in gaps or deciding how to plot sparse data.
    // For simplicity, we'll return the actual logged points. Client can choose how to plot.
    // Or, we can process it into daily points, carrying forward last known weight.

    const chartData: { date: string, weightKg: number | null }[] = [];
    if (metrics.length > 0) {
        const intervalDays = eachDayOfInterval({ start: parseISO(formatISO(metrics[0].date, {representation: 'date'})), end: veryEndDate });
        let lastKnownWeight: number | null = null;

        // Find weight before the period for a starting point if interval starts before first metric
        const metricBeforeInterval = await prisma.bodyMetric.findFirst({
            where: { userId, weightKg: {not: null}, date: { lt: intervalDays[0] }},
            orderBy: { date: 'desc'},
            select: { weightKg: true }
        });
        lastKnownWeight = metricBeforeInterval?.weightKg ?? null;

        let metricPointer = 0;
        for (const day of intervalDays) {
            const dayKey = formatISO(day, { representation: 'date' });
            let weightForDay = lastKnownWeight;
            // Check if there are metrics for this specific day
            while(metricPointer < metrics.length && isSameDay(metrics[metricPointer].date, day)) {
                // If multiple entries on same day, use the latest one (or average, max etc.)
                // For simplicity, using the value of the first one found for that day as logs are ordered by date.
                // A more robust way would be to group by day and take avg/last.
                weightForDay = metrics[metricPointer].weightKg;
                lastKnownWeight = metrics[metricPointer].weightKg; // Update last known weight
                metricPointer++; // Move to next metric to avoid re-processing for same day
            }
             // If no specific metric for this day, but we passed some metrics already, use lastKnownWeight
            if (metrics.length > 0 && metricPointer > 0 && !metrics.slice(metricPointer).some(m => isSameDay(m.date, day))) {
                 // If we iterated past some metrics, and there's no specific metric for *this* day, use the last one.
            }


            chartData.push({
                date: dayKey,
                weightKg: weightForDay
            });
        }
         // Ensure the last logged weight within the period is correctly captured if it's the very last day
        if (metrics.length > 0 && !isSameDay(metrics[metrics.length-1].date, intervalDays[intervalDays.length-1])) {
            // This logic might need refinement if the last day of interval has no data.
            // The current loop should handle it by carrying forward lastKnownWeight.
        }

    }

    // Simpler: just return the logged points
    const simplerChartData = metrics.map(m => ({
        date: formatISO(m.date, { representation: 'date' }),
        weightKg: m.weightKg
    }));


    return NextResponse.json(simplerChartData); // Returning simpler data for client to handle plotting gaps

  } catch (error) {
    console.error('Error fetching weight trend data:', error);
    return NextResponse.json({ error: 'Failed to fetch weight trend data' }, { status: 500 });
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}
