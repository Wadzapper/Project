import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, formatISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d

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
    const sleepLogs = await prisma.sleepLog.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: veryEndDate },
      },
      select: { date: true, quality: true },
      orderBy: { date: 'asc' },
    });

    const dailyRatings = await prisma.dailyRating.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: veryEndDate },
        mood: { not: null }, // Only include days where mood was rated
      },
      select: { date: true, mood: true },
      orderBy: { date: 'asc' },
    });

    // Combine data by date
    const sleepMap = new Map(sleepLogs.map(log => [formatISO(log.date, { representation: 'date' }), log.quality]));
    const moodMap = new Map(dailyRatings.map(rating => [formatISO(rating.date, { representation: 'date' }), rating.mood]));

    const combinedData: { date: string; sleepQuality: number | null; mood: number | null }[] = [];
    const allDates = new Set([...sleepMap.keys(), ...moodMap.keys()]);

    const sortedDates = Array.from(allDates).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    sortedDates.forEach(dateKey => {
        combinedData.push({
            date: dateKey,
            sleepQuality: sleepMap.get(dateKey) ?? null,
            mood: moodMap.get(dateKey) ?? null,
        });
    });

    return NextResponse.json(combinedData);

  } catch (error) {
    console.error('Error fetching sleep-mood correlation data:', error);
    return NextResponse.json({ error: 'Failed to fetch sleep-mood correlation data' }, { status: 500 });
  }
}
