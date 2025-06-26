import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestType, QuestStatus } from '@prisma/client';

interface QuestAnalytics {
  completionRateByType: {
    [key in QuestType]?: {
      totalQuests: number;
      completedQuests: number;
      rate: number;
    };
  };
  recentCompletions: {
    questId: string;
    questTitle: string;
    completedAt: Date | string; // Keep as Date, format on client if needed
  }[];
  // longestStreakForStreakQuests: any; // Deferred for MVP
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const allUserQuests = await prisma.quest.findMany({
      where: { userId: userId },
      select: {
        id: true,
        type: true,
        status: true, // To count completed quests directly from the Quest model
        title: true, // For recent completions
        completedAt: true, // For recent completions
      },
    });

    // 1. Completion Rate by Type
    const completionRateByType: QuestAnalytics['completionRateByType'] = {};
    const questsByType: { [key in QuestType]?: { total: number; completed: number } } = {};

    for (const quest of allUserQuests) {
      if (!questsByType[quest.type]) {
        questsByType[quest.type] = { total: 0, completed: 0 };
      }
      questsByType[quest.type]!.total += 1;
      if (quest.status === QuestStatus.COMPLETED) {
        questsByType[quest.type]!.completed += 1;
      }
    }

    for (const type in questsByType) {
      const stats = questsByType[type as QuestType]!;
      completionRateByType[type as QuestType] = {
        totalQuests: stats.total,
        completedQuests: stats.completed,
        rate: stats.total > 0 ? parseFloat((stats.completed / stats.total).toFixed(2)) : 0,
      };
    }

    // 2. Recent Completions (using Quest model's completedAt for simplicity)
    // This assumes `completedAt` is reliably set when a quest transitions to COMPLETED.
    const recentCompletionsData = allUserQuests
      .filter(q => q.status === QuestStatus.COMPLETED && q.completedAt !== null)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 5)
      .map(q => ({
        questId: q.id,
        questTitle: q.title,
        completedAt: q.completedAt!.toISOString(), // Ensure consistent string format
      }));

    // 3. Longest Streak for Streak Quests - Deferred for MVP

    const analytics: QuestAnalytics = {
      completionRateByType,
      recentCompletions: recentCompletionsData,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Error fetching quest analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch quest analytics' }, { status: 500 });
  }
}
