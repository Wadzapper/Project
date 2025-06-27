import { prisma } from '@/lib/db';
import { QuestType, QuestStatus } from '@prisma/client';

export interface QuestCompletionStatsByType {
  totalQuests: number;
  completedQuests: number;
  rate: number;
}

export interface OverallQuestCompletionStats {
  total: number;
  completed: number;
  rate: number;
}

export interface QuestAnalyticsSummary {
  byType: { [key in QuestType]?: QuestCompletionStatsByType };
  overall: OverallQuestCompletionStats;
}

/**
 * Calculates quest completion statistics for a given user.
 * Includes stats broken down by quest type and overall summary.
 */
export async function calculateQuestCompletionStatsForUser(userId: string): Promise<QuestAnalyticsSummary> {
  const allUserQuests = await prisma.quest.findMany({
    where: { userId: userId },
    select: { type: true, status: true }, // Only fetch necessary fields
  });

  const statsByType: { [key in QuestType]?: { total: number; completed: number } } = {};

  // Initialize for all quest types to ensure all types are present in the output
  for (const type of Object.values(QuestType)) {
    statsByType[type] = { total: 0, completed: 0 };
  }

  for (const quest of allUserQuests) {
    if (!statsByType[quest.type]) { // Should not happen due to pre-initialization but good safeguard
      statsByType[quest.type] = { total: 0, completed: 0 };
    }
    statsByType[quest.type]!.total += 1;
    if (quest.status === QuestStatus.COMPLETED) {
      statsByType[quest.type]!.completed += 1;
    }
  }

  const finalStatsByType: { [key in QuestType]?: QuestCompletionStatsByType } = {};
  let totalQuestsOverall = 0;
  let completedQuestsOverall = 0;

  for (const type of Object.values(QuestType)) {
    const typeStats = statsByType[type]!; // Asserting it's initialized
    finalStatsByType[type] = {
      totalQuests: typeStats.total,
      completedQuests: typeStats.completed,
      rate: typeStats.total > 0 ? parseFloat((typeStats.completed / typeStats.total).toFixed(2)) : 0,
    };
    totalQuestsOverall += typeStats.total;
    completedQuestsOverall += typeStats.completed;
  }

  const overallCompletionRate = totalQuestsOverall > 0
    ? parseFloat((completedQuestsOverall / totalQuestsOverall).toFixed(2))
    : 0;

  return {
    byType: finalStatsByType,
    overall: {
        total: totalQuestsOverall,
        completed: completedQuestsOverall,
        rate: overallCompletionRate,
    }
  };
}

// Add other shared analytics utility functions here in the future
// e.g., for fitness trends, mood averages, skill XP calculations if they become complex and reused.

export async function getRecentFitnessActivity(userId: string, days: number = 7) {
    const NDaysAgo = subDays(startOfDay(new Date()), days - 1);
    const workoutSessions = await prisma.workoutSession.findMany({
      where: {
        userId: userId,
        startTime: { gte: NDaysAgo },
      },
      select: { durationMinutes: true },
    });
    const totalDurationMinutes = workoutSessions.reduce(
      (sum, workout) => sum + (workout.durationMinutes || 0),
      0
    );
    return {
      totalDurationMinutes,
      workoutCount: workoutSessions.length,
      periodDays: days,
    };
}

// Need to import subDays, startOfDay from date-fns
import { subDays, startOfDay } from 'date-fns';
import { RatingCategory } from '@prisma/client';


export async function getAverageMood(userId: string, days: number = 7) {
    const NDaysAgo = subDays(startOfDay(new Date()), days - 1);
    const moodRatings = await prisma.dailyRating.findMany({
        where: {
          userId: userId,
          date: { gte: NDaysAgo },
          category: RatingCategory.MOOD, // Assuming RatingCategory.MOOD exists
        },
        select: { value: true }
      });

      const validMoodRatings = moodRatings.filter(r => r.value !== null).map(r => r.value!);

      const averageMood =
        validMoodRatings.length > 0
          ? parseFloat((validMoodRatings.reduce((sum, rating) => sum + rating, 0) / validMoodRatings.length).toFixed(1))
          : null;

    return {
        averageMoodLastNDays: averageMood,
        moodRatingsCountLastNDays: validMoodRatings.length,
        periodDays: days
    };
}
