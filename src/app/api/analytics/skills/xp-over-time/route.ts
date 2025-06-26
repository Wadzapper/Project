import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, formatISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const skillId = searchParams.get('skillId'); // Optional: if not provided, could be total XP over time
  const period = searchParams.get('period') || '30d'; // e.g., 7d, 30d, 90d, 1y, all

  let startDate: Date;
  const endDate = endOfDay(new Date()); // Up to the end of today

  switch (period) {
    case '7d':
      startDate = startOfDay(subDays(endDate, 6));
      break;
    case '30d':
      startDate = startOfDay(subDays(endDate, 29));
      break;
    case '90d':
      startDate = startOfDay(subDays(endDate, 89));
      break;
    case '1y':
      startDate = startOfDay(subDays(endDate, 364));
      break;
    case 'all':
      const firstLog = await prisma.skillProgressLog.findFirst({
        where: { userId, ...(skillId && { skillId }) },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });
      startDate = firstLog ? startOfDay(firstLog.createdAt) : startOfDay(subDays(endDate, 29)); // Default to 30d if no logs
      break;
    default:
      startDate = startOfDay(subDays(endDate, 29)); // Default to 30 days
  }

  try {
    const whereClause: any = {
      userId,
      createdAt: { gte: startDate, lte: endDate },
    };
    if (skillId) {
      whereClause.skillId = skillId;
    }

    const logs = await prisma.skillProgressLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, xpChange: true, skillId: true }, // Need skillId if not filtering by one specific skill
    });

    // Aggregate XP per day
    // Create a map to store cumulative XP for each day in the interval
    const dailyXpMap = new Map<string, number>();
    const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Initialize map with 0 for all days in the interval (for days with no logs)
    // This part is for showing total XP on a given day, not just XP gained on that day.
    // To get total XP on a given day, we need the skill's XP *before* the period starts.

    // Let's simplify: return XP gained per day for now.
    // A true "XP over time" chart often means cumulative XP.
    // For "XP gained per day":
    const xpGainedPerDay = new Map<string, number>();
    logs.forEach(log => {
        const day = formatISO(log.createdAt, { representation: 'date' });
        xpGainedPerDay.set(day, (xpGainedPerDay.get(day) || 0) + log.xpChange);
    });

    const chartData = intervalDays.map(dayObj => {
        const dayKey = formatISO(dayObj, { representation: 'date' });
        return {
            date: dayKey,
            xpGained: xpGainedPerDay.get(dayKey) || 0, // XP gained on this specific day
        };
    });

    // If skillId is provided, and we want CUMULATIVE XP for that skill:
    let cumulativeXpData = [];
    if (skillId) {
        // Get initial XP before the period for this skill
        const logsBeforePeriod = await prisma.skillProgressLog.aggregate({
            _sum: { xpChange: true },
            where: {
                userId,
                skillId,
                createdAt: { lt: startDate }
            }
        });
        let currentCumulativeXp = logsBeforePeriod._sum.xpChange || 0;

        // Initialize map for daily logs for the specific skill
        const skillLogsPerDay = new Map<string, number>();
        logs.filter(log => log.skillId === skillId).forEach(log => {
            const day = formatISO(log.createdAt, { representation: 'date' });
            skillLogsPerDay.set(day, (skillLogsPerDay.get(day) || 0) + log.xpChange);
        });

        cumulativeXpData = intervalDays.map(dayObj => {
            const dayKey = formatISO(dayObj, { representation: 'date' });
            currentCumulativeXp += (skillLogsPerDay.get(dayKey) || 0);
            return {
                date: dayKey,
                xp: currentCumulativeXp, // Cumulative XP for this skill
            };
        });
        return NextResponse.json(cumulativeXpData);
    } else {
        // If no skillId, return total XP gained across all skills per day
        return NextResponse.json(chartData);
    }

  } catch (error) {
    console.error('Error fetching XP over time data:', error);
    return NextResponse.json({ error: 'Failed to fetch XP data' }, { status: 500 });
  }
}
