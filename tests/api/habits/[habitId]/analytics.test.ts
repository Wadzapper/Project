import { GET } from '@/app/api/habits/[habitId]/analytics/route';
import { createMockRequest } from '@/tests/api/helpers'; // Adjust path if utils.ts is elsewhere
import * as AuthModule from 'next-auth'; // Path to where `auth` is exported for your app
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { format, subDays, addDays } from 'date-fns';
import { HabitGoalType, HabitType } from '@prisma/client';

// Mock the entire next-auth module or specific functions if preferred
// This mocks the `auth` function that your route handler calls.
const mockAuth = vi.spyOn(AuthModule, 'auth');

// Conceptual factory for creating habits and logs
// In a real setup, this would interact with your test database
const createTestUser = async (userId: string) => {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: `Test User ${userId}`,
      email: `${userId}@example.com`,
    },
  });
};

const createHabitWithLogs = async ({
  userId,
  habitId = `habit-${Date.now()}-${Math.random()}`,
  name = 'Test Habit',
  goalType = HabitGoalType.DAILY,
  type = HabitType.GOOD,
  logPattern = { range: 7, successfulLogDaysAgo: [0, 1, 3] }, // days ago from today
}: {
  userId: string;
  habitId?: string;
  name?: string;
  goalType?: HabitGoalType;
  type?: HabitType;
  logPattern?: { range: number; successfulLogDaysAgo: number[] };
}) => {
  const habit = await prisma.habit.create({
    data: {
      id: habitId,
      userId,
      name,
      type,
      goalType,
      frequency: 1, // Default
      // Ensure all required fields from your Habit model are here
      currentStreak: 0,
      longestStreak: 0,
      successCount: 0,
      totalLogCount: 0,
    },
  });

  const today = new Date();
  for (const daysAgo of logPattern.successfulLogDaysAgo) {
    if (daysAgo < logPattern.range) { // Only create logs within the specified pattern range
      await prisma.habitLog.create({
        data: {
          habitId: habit.id,
          userId,
          date: subDays(today, daysAgo),
          isSuccess: true,
          count: 1,
        },
      });
    }
  }
  return habit;
};


describe('GET /api/habits/[habitId]/analytics', () => {
  const testUserId = 'test-user-123';
  let habitDaily: Awaited<ReturnType<typeof createHabitWithLogs>>;

  beforeAll(async () => {
    // Ensure test user exists
    await createTestUser(testUserId);

    // Create a daily habit with a specific log pattern for testing streaks
    // Logs on today, yesterday, (missed 2 days ago), 3 days ago
    habitDaily = await createHabitWithLogs({
      userId: testUserId,
      habitId: 'daily-habit-for-analytics',
      goalType: HabitGoalType.DAILY,
      logPattern: { range: 7, successfulLogDaysAgo: [0, 1, 3] },
    });
  });

  afterAll(async () => {
    // Clean up database
    await prisma.habitLog.deleteMany({ where: { userId: testUserId } });
    await prisma.habit.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks(); // Restore original implementations
  });

  beforeEach(() => {
    // Reset mock for each test to ensure clean state or specific overrides
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null); // Simulate no session
    const req = createMockRequest({
      method: 'GET',
      // Params for App Router are typically handled by the file path and passed by Next.js
      // The handler itself receives { params: { habitId: '...' } }
      // So, the URL in createMockRequest is more for context if needed by URL object
    });
    // For App Router, the params are passed as the second argument to the handler
    const response = await GET(req, { params: { habitId: habitDaily.id } });
    expect(response.status).toBe(401);
  });

  it('should return 404 if habit not found or not owned by user', async () => {
    const req = createMockRequest({ method: 'GET' });
    const response = await GET(req, { params: { habitId: 'non-existent-habit' } });
    expect(response.status).toBe(404);

    // Simulate different user
    mockAuth.mockResolvedValue({ user: { id: 'another-user-id' } });
    const responseNonOwner = await GET(req, { params: { habitId: habitDaily.id } });
    expect(responseNonOwner.status).toBe(404);
  });

  it('should return analytics data with correct shape for a valid habit and range', async () => {
    const range = 7;
    const req = createMockRequest({
      method: 'GET',
      query: { range: String(range) },
    });
    const response = await GET(req, { params: { habitId: habitDaily.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(range);
    data.forEach((item: any) => {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('logged');
      expect(item).toHaveProperty('streak');
      expect(typeof item.date).toBe('string');
      expect(typeof item.logged).toBe('boolean');
      expect(typeof item.streak).toBe('number');
    });
  });

  it('should correctly calculate streak for a DAILY habit with missed days', async () => {
    const range = 7; // Ensure range covers the log pattern
    const req = createMockRequest({
      method: 'GET',
      query: { range: String(range) },
    });
    const response = await GET(req, { params: { habitId: habitDaily.id } });
    const analyticsData: { date: string; logged: boolean; streak: number }[] = await response.json();

    // Expected pattern: Logs on day 0, 1, 3 (days ago). Today is the last element.
    // Data is chronological: data[0] is (today - range + 1), data[range-1] is today.

    // Example: Today is 2023-01-07. Range 7.
    // Dates: 01-01, 01-02, 01-03, 01-04 (logged day 3 ago), 01-05 (missed day 2 ago), 01-06 (logged day 1 ago), 01-07 (logged day 0 ago)
    // Expected Logs: T, T, F, T, F, T, T (if today is day 0, yesterday day 1 etc from logPattern)
    // Expected Streaks based on API logic (resets on non-successful log):
    // If successfully logged: currentStreak++ else currentStreak = 0

    // Logged days ago: [0, 1, 3] for a 7-day range from today.
    // Today (index 6, 0 days ago): Logged = true, Streak = 2 (continued from yesterday)
    // Yesterday (index 5, 1 day ago): Logged = true, Streak = 1 (started/continued)
    // 2 days ago (index 4): Logged = false, Streak = 0 (streak broken)
    // 3 days ago (index 3): Logged = true, Streak = 1 (new streak)
    // 4 days ago (index 2): Logged = false, Streak = 0
    // 5 days ago (index 1): Logged = false, Streak = 0
    // 6 days ago (index 0): Logged = false, Streak = 0

    // Let's find the specific dates to make assertions more robust
    const todayFormatted = format(new Date(), 'yyyy-MM-dd');
    const yesterdayFormatted = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const twoDaysAgoFormatted = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const threeDaysAgoFormatted = format(subDays(new Date(), 3), 'yyyy-MM-dd');

    const todayData = analyticsData.find(d => d.date === todayFormatted);
    const yesterdayData = analyticsData.find(d => d.date === yesterdayFormatted);
    const twoDaysAgoData = analyticsData.find(d => d.date === twoDaysAgoFormatted);
    const threeDaysAgoData = analyticsData.find(d => d.date === threeDaysAgoFormatted);

    expect(todayData?.logged).toBe(true);
    expect(todayData?.streak).toBe(2); // Streak from today + yesterday

    expect(yesterdayData?.logged).toBe(true);
    expect(yesterdayData?.streak).toBe(1); // Started streak yesterday

    expect(twoDaysAgoData?.logged).toBe(false); // Missed day
    expect(twoDaysAgoData?.streak).toBe(0);    // Streak broken

    expect(threeDaysAgoData?.logged).toBe(true);
    expect(threeDaysAgoData?.streak).toBe(1);  // New streak started
  });

  it('should return all logged:false and streak:0 if no successful logs in range', async () => {
    const noLogsHabit = await prisma.habit.create({
      data: { userId: testUserId, name: 'No Logs Habit', type: HabitType.GOOD, goalType: HabitGoalType.DAILY, frequency: 1 },
    });
    const range = 5;
    const req = createMockRequest({ query: { range: String(range) } });
    const response = await GET(req, { params: { habitId: noLogsHabit.id } });
    expect(response.status).toBe(200);
    const data: { logged: boolean; streak: number }[] = await response.json();
    expect(data.length).toBe(range);
    data.forEach(item => {
      expect(item.logged).toBe(false);
      expect(item.streak).toBe(0);
    });
    await prisma.habit.delete({ where: { id: noLogsHabit.id } });
  });
});
