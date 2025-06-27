import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db'; // Actual prisma client
import {
    calculateQuestCompletionStatsForUser,
    getRecentFitnessActivity,
    getAverageMood,
    QuestAnalyticsSummary
} from '../analyticsUtils'; // Adjust path as needed
import { Quest, QuestStatus, QuestType, WorkoutSession, DailyRating, RatingCategory, User } from '@prisma/client';
import { subDays, addDays, startOfDay } from 'date-fns';

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    quest: { findMany: vi.fn() },
    workoutSession: { findMany: vi.fn() },
    dailyRating: { findMany: vi.fn() },
    // Add other models if they become part of more complex utils
  },
}));

const mockPrismaQuestFindMany = prisma.quest.findMany as ReturnType<typeof vi.fn>;
const mockPrismaWorkoutSessionFindMany = prisma.workoutSession.findMany as ReturnType<typeof vi.fn>;
const mockPrismaDailyRatingFindMany = prisma.dailyRating.findMany as ReturnType<typeof vi.fn>;

const testUserId = 'analytics-util-user';

describe('analyticsUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateQuestCompletionStatsForUser', () => {
    it('should correctly calculate quest completion stats', async () => {
      const mockQuests: Partial<Quest>[] = [
        { type: QuestType.DAILY_TASK, status: QuestStatus.COMPLETED },
        { type: QuestType.DAILY_TASK, status: QuestStatus.IN_PROGRESS },
        { type: QuestType.ONE_TIME, status: QuestStatus.COMPLETED },
        { type: QuestType.ONE_TIME, status: QuestStatus.COMPLETED },
        { type: QuestType.WEEKLY_TARGET, status: QuestStatus.PENDING },
      ];
      mockPrismaQuestFindMany.mockResolvedValue(mockQuests as Quest[]);

      const stats = await calculateQuestCompletionStatsForUser(testUserId);

      expect(prisma.quest.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { type: true, status: true },
      });

      expect(stats.byType[QuestType.DAILY_TASK]?.totalQuests).toBe(2);
      expect(stats.byType[QuestType.DAILY_TASK]?.completedQuests).toBe(1);
      expect(stats.byType[QuestType.DAILY_TASK]?.rate).toBe(0.50);

      expect(stats.byType[QuestType.ONE_TIME]?.totalQuests).toBe(2);
      expect(stats.byType[QuestType.ONE_TIME]?.completedQuests).toBe(2);
      expect(stats.byType[QuestType.ONE_TIME]?.rate).toBe(1.00);

      expect(stats.byType[QuestType.WEEKLY_TARGET]?.totalQuests).toBe(1);
      expect(stats.byType[QuestType.WEEKLY_TARGET]?.completedQuests).toBe(0);
      expect(stats.byType[QuestType.WEEKLY_TARGET]?.rate).toBe(0.00);

      // Check for types that might not have quests
      expect(stats.byType[QuestType.DEADLINE]?.totalQuests).toBe(0);
      expect(stats.byType[QuestType.DEADLINE]?.completedQuests).toBe(0);
      expect(stats.byType[QuestType.DEADLINE]?.rate).toBe(0);


      expect(stats.overall.total).toBe(5);
      expect(stats.overall.completed).toBe(3);
      expect(stats.overall.rate).toBe(0.60); // 3/5
    });

    it('should handle cases with no quests', async () => {
      mockPrismaQuestFindMany.mockResolvedValue([]);
      const stats = await calculateQuestCompletionStatsForUser(testUserId);
      for (const type of Object.values(QuestType)) {
        expect(stats.byType[type]?.totalQuests).toBe(0);
        expect(stats.byType[type]?.completedQuests).toBe(0);
        expect(stats.byType[type]?.rate).toBe(0);
      }
      expect(stats.overall.total).toBe(0);
      expect(stats.overall.completed).toBe(0);
      expect(stats.overall.rate).toBe(0);
    });
  });

  describe('getRecentFitnessActivity', () => {
    it('should correctly sum workout durations and count sessions for the last N days', async () => {
      const mockWorkouts: Partial<WorkoutSession>[] = [
        { durationMinutes: 30, startTime: subDays(new Date(), 1) },
        { durationMinutes: 45, startTime: subDays(new Date(), 3) },
        { durationMinutes: 60, startTime: subDays(new Date(), 8) }, // Outside default 7-day range
      ];
      mockPrismaWorkoutSessionFindMany.mockResolvedValue(mockWorkouts.filter(w => w.startTime! >= subDays(startOfDay(new Date()), 7-1)) as WorkoutSession[]);

      const activity = await getRecentFitnessActivity(testUserId, 7);

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          startTime: { gte: expect.any(Date) }, // Check if date is roughly 7 days ago
        },
        select: { durationMinutes: true },
      });
      expect(activity.totalDurationMinutes).toBe(30 + 45);
      expect(activity.workoutCount).toBe(2);
      expect(activity.periodDays).toBe(7);
    });

     it('should return 0 if no workouts in range', async () => {
      mockPrismaWorkoutSessionFindMany.mockResolvedValue([]);
      const activity = await getRecentFitnessActivity(testUserId, 7);
      expect(activity.totalDurationMinutes).toBe(0);
      expect(activity.workoutCount).toBe(0);
    });
  });

  describe('getAverageMood', () => {
    it('should correctly calculate average mood for the last N days', async () => {
      const mockRatings: Partial<DailyRating>[] = [
        { category: RatingCategory.MOOD, value: 4, date: subDays(new Date(), 1) },
        { category: RatingCategory.MOOD, value: 5, date: subDays(new Date(), 2) },
        { category: RatingCategory.PRODUCTIVITY, value: 3, date: subDays(new Date(), 1) }, // Different category
        { category: RatingCategory.MOOD, value: null, date: subDays(new Date(), 3) }, // Null value
        { category: RatingCategory.MOOD, value: 3, date: subDays(new Date(), 8) }, // Outside default 7-day range
      ];
      // Filter mockRatings as the DB query would
      const relevantRatings = mockRatings.filter(r =>
            r.category === RatingCategory.MOOD &&
            r.date! >= subDays(startOfDay(new Date()), 7-1) &&
            r.value !== null
        ) as DailyRating[];

      mockPrismaDailyRatingFindMany.mockResolvedValue(relevantRatings);

      const moodData = await getAverageMood(testUserId, 7);

      expect(prisma.dailyRating.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          date: { gte: expect.any(Date) },
          category: RatingCategory.MOOD,
        },
        select: { value: true },
      });
      expect(moodData.averageMoodLastNDays).toBe(((4+5)/2).toFixed(1)); // (4+5)/2 = 4.5
      expect(moodData.moodRatingsCountLastNDays).toBe(2);
      expect(moodData.periodDays).toBe(7);
    });

    it('should return null average if no mood ratings in range', async () => {
      mockPrismaDailyRatingFindMany.mockResolvedValue([]);
      const moodData = await getAverageMood(testUserId, 7);
      expect(moodData.averageMoodLastNDays).toBeNull();
      expect(moodData.moodRatingsCountLastNDays).toBe(0);
    });
  });
});
