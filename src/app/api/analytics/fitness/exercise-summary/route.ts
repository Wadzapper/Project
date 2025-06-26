import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '30d';
  const exerciseName = searchParams.get('exerciseName'); // Optional, to filter by a specific exercise

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today);

  switch (period) {
    case '7d': startDate = startOfDay(subDays(veryEndDate, 6)); break;
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case 'all': // Requires finding the first workout session date
      const firstSession = await prisma.workoutSession.findFirst({
        where: { userId }, orderBy: { date: 'asc' }, select: { date: true }
      });
      startDate = firstSession ? startOfDay(firstSession.date) : startOfDay(subDays(veryEndDate, 29));
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 29));
  }

  try {
    const exerciseEntries = await prisma.exerciseEntry.findMany({
      where: {
        session: {
          userId,
          date: { gte: startDate, lte: veryEndDate },
        },
        ...(exerciseName && { name: { contains: exerciseName, mode: 'insensitive' } }), // Filter by exercise name if provided
      },
      include: {
        sets: {
          select: { reps: true, weightKg: true }
        },
      },
    });

    // Aggregate data: total reps and total volume (reps * weight) per exercise name
    const summaryMap = new Map<string, { totalReps: number, totalSets: number, totalVolume: number }>();

    exerciseEntries.forEach(entry => {
      const current = summaryMap.get(entry.name) || { totalReps: 0, totalSets: 0, totalVolume: 0 };
      entry.sets.forEach(set => {
        current.totalReps += set.reps;
        current.totalSets += 1;
        if (set.weightKg) {
          current.totalVolume += set.reps * set.weightKg;
        }
      });
      summaryMap.set(entry.name, current);
    });

    const chartData = Array.from(summaryMap.entries()).map(([name, data]) => ({
      exerciseName: name,
      totalReps: data.totalReps,
      totalSets: data.totalSets,
      totalVolume: parseFloat(data.totalVolume.toFixed(2)),
    })).sort((a,b) => b.totalVolume - a.totalVolume); // Sort by volume desc

    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Error fetching exercise summary:', error);
    return NextResponse.json({ error: 'Failed to fetch exercise summary' }, { status: 500 });
  }
}
