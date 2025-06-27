// Summary: Tests for Quest Template API Endpoints
// TODO: Add tests for linkedSkillIds validation in POST/PATCH.
// TODO: Add tests for instantiation logic, especially QuestDependency creation.

import { GET as getQuestTemplates, POST as createQuestTemplate } from '@/app/api/quest-templates/route';
import { GET as getQuestTemplateById, PATCH as updateQuestTemplate, DELETE as deleteQuestTemplate } from '@/app/api/quest-templates/[templateId]/route';
import { POST as instantiateQuestTemplate } from '@/app/api/quest-templates/[templateId]/instantiate/route';

import { createMockRequest } from '@/tests/api/helpers';
import * as AuthModule from 'next-auth';
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { QuestType, QuestTemplate, Skill } from '@prisma/client';

const mockAuth = vi.spyOn(AuthModule, 'auth');
const testUserId = 'quest-template-user';
let testSkill1: Skill;
let testSkill2: Skill;

const createTestUser = async (userId: string) => prisma.user.upsert({
    where: { id: userId }, update: {}, create: { id: userId, name: `User ${userId}`, email: `${userId}@example.com` }
});

describe('Quest Template API Endpoints', () => {

  beforeAll(async () => {
    await createTestUser(testUserId);
    testSkill1 = await prisma.skill.create({ data: { userId: testUserId, name: 'QT Skill 1', currentLevel: 1, currentXp: 0, targetXpForNextLevel: 100 }});
    testSkill2 = await prisma.skill.create({ data: { userId: testUserId, name: 'QT Skill 2', currentLevel: 1, currentXp: 0, targetXpForNextLevel: 100 }});
  });

  afterAll(async () => {
    await prisma.questDependency.deleteMany({where: {quest: {userId: testUserId}}});
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.questTemplate.deleteMany({ where: { userId: testUserId } });
    await prisma.skill.deleteMany({ where: { id: { in: [testSkill1.id, testSkill2.id]}}});
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await prisma.questDependency.deleteMany({where: {quest: {userId: testUserId}}});
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.questTemplate.deleteMany({ where: { userId: testUserId } });
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  const templateData = {
    title: 'My Test Quest Template',
    description: 'A template for repeatable quests',
    type: QuestType.DAILY_TASK,
    xpReward: 50,
    linkedSkillIds: [testSkill1.id],
  };

  describe('POST /api/quest-templates', () => {
    it('should create a new quest template successfully', async () => {
      const req = createMockRequest({ method: 'POST', body: templateData });
      const response = await createQuestTemplate(req);
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.title).toBe(templateData.title);
      expect(result.userId).toBe(testUserId);
      expect(result.linkedSkillIds).toEqual([testSkill1.id]);
    });
    it('should return 401 if unauthenticated', async () => {
        mockAuth.mockResolvedValue(null);
        const req = createMockRequest({ method: 'POST', body: templateData });
        const response = await createQuestTemplate(req);
        expect(response.status).toBe(401);
    });
    it('should return 400 for invalid skillId in linkedSkillIds', async () => {
        const invalidTemplateData = {...templateData, linkedSkillIds: ['non-existent-skill-id']};
        const req = createMockRequest({ method: 'POST', body: invalidTemplateData });
        const response = await createQuestTemplate(req);
        expect(response.status).toBe(400); // As per current validation
    });
  });

  describe('GET /api/quest-templates', () => {
    it('should return quest templates for the authenticated user', async () => {
      await prisma.questTemplate.create({ data: { ...templateData, userId: testUserId } });
      const req = createMockRequest({ method: 'GET' });
      const response = await getQuestTemplates(req);
      expect(response.status).toBe(200);
      const results = await response.json();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].title).toBe(templateData.title);
    });
     it('should handle archived filter', async () => {
      await prisma.questTemplate.create({ data: { ...templateData, userId: testUserId, isArchived: true } });
      await prisma.questTemplate.create({ data: { ...templateData, title: "Active Template", userId: testUserId, isArchived: false } });

      let req = createMockRequest({ method: 'GET', query: {archived: 'true'} });
      let response = await getQuestTemplates(req);
      let results = await response.json();
      expect(results.length).toBe(2); // Both

      req = createMockRequest({ method: 'GET' }); // Default (archived=false)
      response = await getQuestTemplates(req);
      results = await response.json();
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Active Template");
    });
  });

  describe('Individual Quest Template Operations (/api/quest-templates/[templateId])', () => {
    let createdTemplate: QuestTemplate;
    beforeEach(async () => {
      createdTemplate = await prisma.questTemplate.create({ data: { ...templateData, userId: testUserId } });
    });

    it('GET should return a specific quest template', async () => {
      const req = createMockRequest({ method: 'GET' });
      const response = await getQuestTemplateById(req, { params: { templateId: createdTemplate.id } });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.id).toBe(createdTemplate.id);
      expect(result.title).toBe(templateData.title);
    });

    it('PATCH should update a quest template', async () => {
      const updates = { title: 'Updated Template Title', xpReward: 75, linkedSkillIds: [testSkill1.id, testSkill2.id] };
      const req = createMockRequest({ method: 'PATCH', body: updates });
      const response = await updateQuestTemplate(req, { params: { templateId: createdTemplate.id } });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.title).toBe(updates.title);
      expect(result.xpReward).toBe(updates.xpReward);
      expect(result.linkedSkillIds).toEqual(updates.linkedSkillIds);
    });

    it('DELETE should toggle archive status of a quest template', async () => {
      let req = createMockRequest({ method: 'DELETE' });
      let response = await deleteQuestTemplate(req, { params: { templateId: createdTemplate.id } });
      expect(response.status).toBe(200);
      let result = await response.json();
      expect(result.template.isArchived).toBe(true);
      expect(result.message).toContain('archived');

      response = await deleteQuestTemplate(req, { params: { templateId: createdTemplate.id } });
      expect(response.status).toBe(200);
      result = await response.json();
      expect(result.template.isArchived).toBe(false);
      expect(result.message).toContain('unarchived');
    });
  });

  describe('POST /api/quest-templates/[templateId]/instantiate', () => {
    let templateToInstantiate: QuestTemplate;
     beforeEach(async () => {
      templateToInstantiate = await prisma.questTemplate.create({
        data: { ...templateData, userId: testUserId, linkedSkillIds: [testSkill1.id] }
      });
    });

    it('should instantiate a quest from a template', async () => {
      const req = createMockRequest({ method: 'POST', body: {} }); // No body needed for instantiation
      const response = await instantiateQuestTemplate(req, { params: { templateId: templateToInstantiate.id }});
      expect(response.status).toBe(201);
      const newQuest = await response.json();
      expect(newQuest.title).toBe(templateToInstantiate.title);
      expect(newQuest.userId).toBe(testUserId);
      expect(newQuest.status).toBe(QuestStatus.PENDING);
      expect(newQuest.dependencies).toBeDefined();
      // Check if dependency was created for testSkill1
      const skillDep = newQuest.dependencies.find((d: any) => d.skillId === testSkill1.id);
      expect(skillDep).toBeDefined();
      expect(skillDep.type).toBe(QuestDependencyType.SKILL_TARGET_LEVEL); // As per current MVP logic
    });

    it('should return 404 if template not found or not owned', async () => {
        const req = createMockRequest({ method: 'POST', body: {} });
        const response = await instantiateQuestTemplate(req, { params: { templateId: 'non-existent-template' }});
        expect(response.status).toBe(404);
    });

    it('should return 400 if template is archived', async () => {
        await prisma.questTemplate.update({where: {id: templateToInstantiate.id}, data: {isArchived: true}});
        const req = createMockRequest({ method: 'POST', body: {} });
        const response = await instantiateQuestTemplate(req, { params: { templateId: templateToInstantiate.id }});
        expect(response.status).toBe(400);
    });
  });
});
