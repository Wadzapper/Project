import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { startOfYear, endOfYear, formatISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  const startDate = startOfYear(new Date(year, 0, 1)); // Jan 1st of the year
  const endDate = endOfYear(new Date(year, 11, 31));   // Dec 31st of the year

  try {
    const entriesInYear = await prisma.journalEntry.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { date: true }, // Only need the date for grouping
    });

    // Group entries by date and count
    const heatmapDataMap = new Map<string, number>();
    entriesInYear.forEach(entry => {
      // Normalize date to YYYY-MM-DD string to ensure accurate grouping by day
      const dayKey = formatISO(entry.date, { representation: 'date' });
      heatmapDataMap.set(dayKey, (heatmapDataMap.get(dayKey) || 0) + 1);
    });

    const chartData = Array.from(heatmapDataMap.entries()).map(([date, count]) => ({
      date, // YYYY-MM-DD
      count,
    }));

    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Error fetching journal heatmap data:', error);
    return NextResponse.json({ error: 'Failed to fetch journal heatmap data' }, { status: 500 });
  }
}
