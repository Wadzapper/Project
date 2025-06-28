import { prisma } from '@/lib/db';
import { QuestType, QuestStatus, DailyRating } from '@prisma/client'; // Added DailyRating
import { subDays, startOfDay } from 'date-fns'; // Moved to top

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

export async function calculateQuestCompletionStatsForUser(userId: string): Promise<QuestAnalyticsSummary> {
  const allUserQuests = await prisma.quest.findMany({
    where: { userId: userId },
    select: { type: true, status: true },
  });

  const statsByType: { [key in QuestType]?: { total: number; completed: number } } = {};

  for (const type of Object.values(QuestType)) {
    statsByType[type] = { total: 0, completed: 0 };
  }

  for (const quest of allUserQuests) {
    statsByType[quest.type]!.total += 1;
    if (quest.status === QuestStatus.COMPLETED) {
      statsByType[quest.type]!.completed += 1;
    }
  }

  const finalStatsByType: { [key in QuestType]?: QuestCompletionStatsByType } = {};
  let totalQuestsOverall = 0;
  let completedQuestsOverall = 0;

  for (const type of Object.values(QuestType)) {
    const typeStats = statsByType[type]!;
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

export async function getRecentFitnessActivity(userId: string, days: number = 7) {
    const NDaysAgo = subDays(startOfDay(new Date()), days - 1);
    const workoutSessions = await prisma.workoutSession.findMany({
      where: {
        userId: userId,
        // Assuming WorkoutSession has a 'date' or 'startTime' field
        date: { gte: NDaysAgo },
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

export async function getAverageMood(userId: string, days: number = 7) {
    const NDaysAgo = subDays(startOfDay(new Date()), days - 1);
    const moodRatings = await prisma.dailyRating.findMany({
        where: {
          userId: userId,
          date: { gte: NDaysAgo },
          mood: { not: null }, // Ensure mood value exists
        },
        select: { mood: true } // Select the mood field
      });

      // Filter out any potential nulls again just in case, and ensure it's a number
      const validMoodRatings = moodRatings
        .map(r => r.mood)
        .filter((moodValue): moodValue is number => typeof moodValue === 'number');

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
