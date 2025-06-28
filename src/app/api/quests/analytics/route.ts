import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestType, QuestStatus } from '@prisma/client';
import { calculateQuestCompletionStatsForUser, QuestAnalyticsSummary } from '@/lib/analyticsUtils'; // Import shared utility

interface QuestAnalyticsResponse {
  completionRateByType: QuestAnalyticsSummary['byType']; // Use the byType part from the shared utility's return
  recentCompletions: {
    questId: string;
    questTitle: string;
    completedAt: string;
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
    // 1. Completion Rate by Type - Use shared utility
    const questStats = await calculateQuestCompletionStatsForUser(userId);

    // 2. Recent Completions
    // We still need a direct query for this as calculateQuestCompletionStatsForUser doesn't return individual quests.
    const recentUserQuests = await prisma.quest.findMany({
        where: {
            userId: userId,
            status: QuestStatus.COMPLETED,
            completedAt: { not: null }
        },
        select: {
          id: true,
          name: true, // Changed from title
          completedAt: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });

    const recentCompletionsData = recentUserQuests.map(q => ({
        questId: q.id,
        questTitle: q.name, // Changed from q.title
        completedAt: q.completedAt!.toISOString(), // Assert non-null due to where clause
    }));


    const analytics: QuestAnalyticsResponse = {
      completionRateByType: questStats.byType,
      recentCompletions: recentCompletionsData,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Error fetching quest analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch quest analytics' }, { status: 500 });
  }
}
