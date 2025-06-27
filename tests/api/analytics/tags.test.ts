// Summary: Tests for the Tag Analytics API Endpoint.
// TODO: Test with tags having only habit associations or only quest associations.

import { GET as getTagAnalytics } from '@/app/api/analytics/tags/route';
import { createMockRequest } from '@/tests/api/helpers';
import * as AuthModule from 'next-auth';
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { User, Tag, Habit, Quest, HabitType, HabitGoalType, QuestType } from '@prisma/client';

const mockAuth = vi.spyOn(AuthModule, 'auth');
const testUserId = 'tag-analytics-user';
let testUser: User;
let tag1: Tag, tag2: Tag, tag3: Tag;
let habit1: Habit, habit2: Habit;
let quest1: Quest;

describe('GET /api/analytics/tags', () => {
  beforeAll(async () => {
    testUser = await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: { id: testUserId, name: 'Tag Analytics User', email: 'taganalytics@example.com' },
    });

    // Create Tags
    tag1 = await prisma.tag.create({ data: { userId: testUserId, name: 'Work', color: '#FF0000' } });
    tag2 = await prisma.tag.create({ data: { userId: testUserId, name: 'Health', color: '#00FF00' } });
    tag3 = await prisma.tag.create({ data: { userId: testUserId, name: 'Learning' } }); // No color

    // Create Habits
    habit1 = await prisma.habit.create({ data: { userId: testUserId, name: 'Morning Report', type: HabitType.GOOD, goalType: HabitGoalType.DAILY } });
    habit2 = await prisma.habit.create({ data: { userId: testUserId, name: 'Gym Session', type: HabitType.GOOD, goalType: HabitGoalType.WEEKLY_TARGET, frequency: 3 } });

    // Create Quest
    quest1 = await prisma.quest.create({ data: { userId: testUserId, title: 'Learn Prisma', type: QuestType.SKILL_MASTERY } });

    // Link Tags
    // Tag1 (Work): habit1, quest1
    await prisma.habitTag.create({ data: { habitId: habit1.id, tagId: tag1.id, assignedBy: testUserId } });
    await prisma.questTag.create({ data: { questId: quest1.id, tagId: tag1.id, assignedBy: testUserId } });

    // Tag2 (Health): habit2
    await prisma.habitTag.create({ data: { habitId: habit2.id, tagId: tag2.id, assignedBy: testUserId } });

    // Tag3 (Learning): No direct links for this setup, will have 0 counts.
  });

  afterAll(async () => {
    await prisma.habitTag.deleteMany({ where: { tag: { userId: testUserId } } });
    await prisma.questTag.deleteMany({ where: { tag: { userId: testUserId } } });
    await prisma.tag.deleteMany({ where: { userId: testUserId } });
    await prisma.habit.deleteMany({ where: { userId: testUserId } });
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  it('should return 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = createMockRequest({ method: 'GET' });
    const response = await getTagAnalytics(req);
    expect(response.status).toBe(401);
  });

  it('should return tag analytics with correct counts', async () => {
    const req = createMockRequest({ method: 'GET' });
    const response = await getTagAnalytics(req);
    expect(response.status).toBe(200);

    const data: { id: string, name: string, color: string | null, habitCount: number, questCount: number }[] = await response.json();
    expect(data.length).toBe(3); // tag1, tag2, tag3

    const workTag = data.find(t => t.name === 'Work');
    expect(workTag).toBeDefined();
    expect(workTag?.color).toBe('#FF0000');
    expect(workTag?.habitCount).toBe(1); // habit1
    expect(workTag?.questCount).toBe(1); // quest1

    const healthTag = data.find(t => t.name === 'Health');
    expect(healthTag).toBeDefined();
    expect(healthTag?.color).toBe('#00FF00');
    expect(healthTag?.habitCount).toBe(1); // habit2
    expect(healthTag?.questCount).toBe(0);

    const learningTag = data.find(t => t.name === 'Learning');
    expect(learningTag).toBeDefined();
    expect(learningTag?.color).toBeNull();
    expect(learningTag?.habitCount).toBe(0);
    expect(learningTag?.questCount).toBe(0);
  });

  it('should return empty array if user has no tags', async () => {
    // Temporarily delete tags for this user for this test case
    await prisma.habitTag.deleteMany({ where: { tag: { userId: testUserId } } });
    await prisma.questTag.deleteMany({ where: { tag: { userId: testUserId } } });
    await prisma.tag.deleteMany({ where: { userId: testUserId } });

    const req = createMockRequest({ method: 'GET' });
    const response = await getTagAnalytics(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual([]);

    // Recreate tags for other tests (or rely on beforeEach if it handles full recreation)
    // For simplicity, afterAll will clean up. If tests were isolated in files, this wouldn't be an issue.
    // This highlights a dependency between tests if not careful with data setup/teardown.
    // A better approach would be to use a dedicated test user for this specific test.
  });

  // This test relies on the Prisma mock returning a specific error
  it('should return 501 if Tag tables are missing (conceptual)', async () => {
    const originalPrismaTag = prisma.tag;
    (prisma.tag as any) = {
        findMany: vi.fn().mockRejectedValue({ code: 'P2021', message: "Table `main.Tag` doesn't exist" })
    };

    const req = createMockRequest({ method: 'GET' });
    const response = await getTagAnalytics(req);
    expect(response.status).toBe(501);
    const error = await response.json();
    expect(error.error).toContain("Tag feature might not be fully set up");

    (prisma.tag as any) = originalPrismaTag; // Restore
  });
});
