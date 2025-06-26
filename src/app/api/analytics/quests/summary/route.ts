import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const questCountsByStatus = await prisma.quest.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        id: true,
      },
    });

    let totalQuests = 0;
    let completedQuests = 0;
    const statusCounts: { [key in QuestStatus]?: number } = {};

    questCountsByStatus.forEach(group => {
      statusCounts[group.status] = group._count.id;
      totalQuests += group._count.id;
      if (group.status === QuestStatus.COMPLETED) {
        completedQuests = group._count.id;
      }
    });

    // Ensure all statuses are present in the output, even if count is 0
    for (const status of Object.values(QuestStatus)) {
        if (!statusCounts[status]) {
            statusCounts[status] = 0;
        }
    }


    const completionRate = totalQuests > 0 ? (completedQuests / totalQuests) * 100 : 0;

    // Example: Longest quest streak (if streak data was on Quest model directly, or via logs)
    // This is more complex and depends on how streaks are defined and tracked.
    // For MVP, focusing on status counts and completion rate.
    // const longestStreak = ...;

    return NextResponse.json({
      statusCounts,
      totalQuests,
      completedQuests,
      completionRate: parseFloat(completionRate.toFixed(2)),
      // longestStreak: longestStreak || 0, // Placeholder
    });

  } catch (error) {
    console.error('Error fetching quests summary:', error);
    return NextResponse.json({ error: 'Failed to fetch quests summary' }, { status: 500 });
  }
}
