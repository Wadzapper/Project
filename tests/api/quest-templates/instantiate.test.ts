// Summary: Tests for the Quest Template Instantiation API Endpoint.
// TODO: Test with templates having no linkedSkillIds.
// TODO: If dependency creation becomes more complex (e.g. template defines target levels), add tests for that.

import { POST as instantiateQuestTemplate } from '@/app/api/quest-templates/[templateId]/instantiate/route';
import { createMockRequest } from '@/tests/api/helpers';
import * as AuthModule from 'next-auth';
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { QuestType, QuestTemplate, Skill, QuestStatus, QuestDependencyType, User } from '@prisma/client';

const mockAuth = vi.spyOn(AuthModule, 'auth');
const testUserId = 'qt-instantiate-user';
let testUser: User;
let testSkill1: Skill;
let testQuestTemplate: QuestTemplate;

describe('POST /api/quest-templates/[templateId]/instantiate', () => {
  beforeAll(async () => {
    testUser = await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: { id: testUserId, name: 'QT Instantiate User', email: 'qtinst@example.com' },
    });
    testSkill1 = await prisma.skill.create({
      data: { userId: testUserId, name: 'Skill For Template Instantiation', currentLevel: 1, currentXp: 0, targetXpForNextLevel: 100 },
    });
  });

  beforeEach(async () => {
    // Clear quests and their dependencies, then recreate template for each test
    await prisma.questDependency.deleteMany({ where: { quest: { userId: testUserId } } });
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.questTemplate.deleteMany({ where: { userId: testUserId } });

    testQuestTemplate = await prisma.questTemplate.create({
      data: {
        userId: testUserId,
        title: 'Template to Instantiate',
        description: 'Test description',
        type: QuestType.SKILL_MASTERY,
        xpReward: 100,
        linkedSkillIds: [testSkill1.id],
        isArchived: false,
      },
    });
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  afterAll(async () => {
    await prisma.questDependency.deleteMany({ where: { quest: { userId: testUserId } } });
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.questTemplate.deleteMany({ where: { userId: testUserId } });
    await prisma.skill.deleteMany({ where: { id: testSkill1.id } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks();
  });

  it('should successfully instantiate a quest from a template', async () => {
    const req = createMockRequest({ method: 'POST', body: {} });
    const response = await instantiateQuestTemplate(req, { params: { templateId: testQuestTemplate.id } });

    expect(response.status).toBe(201);
    const newQuest = await response.json();

    expect(newQuest.title).toBe(testQuestTemplate.title);
    expect(newQuest.description).toBe(testQuestTemplate.description);
    expect(newQuest.type).toBe(testQuestTemplate.type);
    expect(newQuest.xpReward).toBe(testQuestTemplate.xpReward);
    expect(newQuest.status).toBe(QuestStatus.PENDING);
    expect(newQuest.userId).toBe(testUserId);

    expect(newQuest.dependencies).toBeDefined();
    expect(newQuest.dependencies.length).toBe(1);
    expect(newQuest.dependencies[0].skillId).toBe(testSkill1.id);
    expect(newQuest.dependencies[0].type).toBe(QuestDependencyType.SKILL_TARGET_LEVEL); // Based on MVP logic
  });

  it('should return 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = createMockRequest({ method: 'POST', body: {} });
    const response = await instantiateQuestTemplate(req, { params: { templateId: testQuestTemplate.id } });
    expect(response.status).toBe(401);
  });

  it('should return 404 if template not found', async () => {
    const req = createMockRequest({ method: 'POST', body: {} });
    const response = await instantiateQuestTemplate(req, { params: { templateId: 'non-existent-id' } });
    expect(response.status).toBe(404);
  });

  it('should return 404 if template belongs to another user', async () => {
    const otherUserTemplate = await prisma.questTemplate.create({
        data: { userId: 'otherUser', title: 'Other User Template', type: QuestType.ONE_TIME }
    });
    const req = createMockRequest({ method: 'POST', body: {} });
    const response = await instantiateQuestTemplate(req, { params: { templateId: otherUserTemplate.id }});
    expect(response.status).toBe(404); // Or 403, current logic returns 404 as it's not found for the user
    await prisma.questTemplate.delete({where: {id: otherUserTemplate.id}});
  });

  it('should return 400 if template is archived', async () => {
    await prisma.questTemplate.update({
      where: { id: testQuestTemplate.id },
      data: { isArchived: true },
    });
    const req = createMockRequest({ method: 'POST', body: {} });
    const response = await instantiateQuestTemplate(req, { params: { templateId: testQuestTemplate.id } });
    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('archived');
  });
});
