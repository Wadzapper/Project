import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { subDays, startOfWeek, startOfMonth, endOfDay, startOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Assuming Monday is start of week
    const startOfThisMonth = startOfMonth(now);

    // Total XP Gained - All Time
    const totalXpAllTime = await prisma.skillProgressLog.aggregate({
      _sum: { xpChange: true },
      where: { userId, xpChange: { gt: 0 } },
    });

    // Total XP Gained - This Month
    const totalXpThisMonth = await prisma.skillProgressLog.aggregate({
      _sum: { xpChange: true },
      where: { userId, xpChange: { gt: 0 }, createdAt: { gte: startOfThisMonth } },
    });

    // Total XP Gained - This Week
    const totalXpThisWeek = await prisma.skillProgressLog.aggregate({
      _sum: { xpChange: true },
      where: { userId, xpChange: { gt: 0 }, createdAt: { gte: startOfThisWeek } },
    });

    // Total XP Gained - Today
    const totalXpToday = await prisma.skillProgressLog.aggregate({
      _sum: { xpChange: true },
      where: { userId, xpChange: { gt: 0 }, createdAt: { gte: todayStart } },
    });

    // Total XP Gained - Yesterday
    const totalXpYesterday = await prisma.skillProgressLog.aggregate({
      _sum: { xpChange: true },
      where: { userId, xpChange: { gt: 0 }, createdAt: { gte: yesterdayStart, lt: todayStart } },
    });


    // Number of skills leveled up (unique skills that had a positive level change)
    // This is a bit more complex. We need to see where newLevel > oldLevel.
    // SkillProgressLog stores newLevel. We need to compare with previous log or initial state.
    // Simpler for now: count skills that have currentLevel > 1
    const leveledUpSkillsCount = await prisma.skill.count({
      where: { userId, currentLevel: { gt: 1 } },
    });

    // Top 3 skills by current level
    const topSkillsByLevel = await prisma.skill.findMany({
      where: { userId },
      orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }],
      take: 3,
      select: { id: true, name: true, currentLevel: true, currentXp: true, targetXpForNextLevel: true },
    });

    // Top 3 skills by XP gain this month
     const topSkillsByXpGainThisMonth = await prisma.skillProgressLog.groupBy({
      by: ['skillId'],
      where: {
        userId,
        xpChange: { gt: 0 },
        createdAt: { gte: startOfThisMonth },
      },
      _sum: { xpChange: true },
      orderBy: { _sum: { xpChange: 'desc' } },
      take: 3,
    });

    const skillIds = topSkillsByXpGainThisMonth.map(s => s.skillId);
    const skillDetails = await prisma.skill.findMany({
        where: { id: { in: skillIds }},
        select: { id: true, name: true }
    });
    const skillMap = new Map(skillDetails.map(s => [s.id, s.name]));

    const topSkillsByXpGainThisMonthWithName = topSkillsByXpGainThisMonth.map(s => ({
        skillId: s.skillId,
        name: skillMap.get(s.skillId) || 'Unknown Skill',
        totalXpGained: s._sum.xpChange
    }));


    return NextResponse.json({
      totalXpAllTime: totalXpAllTime._sum.xpChange || 0,
      totalXpThisMonth: totalXpThisMonth._sum.xpChange || 0,
      totalXpThisWeek: totalXpThisWeek._sum.xpChange || 0,
      totalXpToday: totalXpToday._sum.xpChange || 0,
      totalXpYesterday: totalXpYesterday._sum.xpChange || 0,
      leveledUpSkillsCount, // This is a simplified count
      topSkillsByLevel,
      topSkillsByXpGainThisMonth: topSkillsByXpGainThisMonthWithName,
    });

  } catch (error) {
    console.error('Error fetching skills summary:', error);
    return NextResponse.json({ error: 'Failed to fetch skills summary' }, { status: 500 });
  }
}
