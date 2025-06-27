import { GET as getPaths, POST as createPath } from '@/app/api/paths/route';
import { GET as getPathById } from '@/app/api/paths/[pathId]/route';
import { POST as addPathStep } from '@/app/api/paths/[pathId]/steps/route';
import { PATCH as updatePathStep } from '@/app/api/paths/[pathId]/steps/[stepId]/route';

import { createMockRequest } from '@/tests/api/helpers';
import * as AuthModule from 'next-auth';
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PathStepType, QuestType, Skill, Quest, Path, PathStep } from '@prisma/client'; // Import necessary Prisma types

const mockAuth = vi.spyOn(AuthModule, 'auth');
const testUserId = 'path-test-user';
let testSkill: Skill;
let testQuest: Quest;

const createTestUser = async (userId: string) => prisma.user.upsert({
    where: { id: userId }, update: {}, create: { id: userId, name: `User ${userId}`, email: `${userId}@example.com` }
});

describe('Path API Endpoints', () => {

  beforeAll(async () => {
    await createTestUser(testUserId);
    testSkill = await prisma.skill.create({
      data: { userId: testUserId, name: 'Test Skill for Paths', currentLevel: 1, currentXp: 0, targetXpForNextLevel: 100 }
    });
    testQuest = await prisma.quest.create({
      data: { userId: testUserId, title: 'Test Quest for Paths', type: QuestType.ONE_TIME, xpReward: 50 }
    });
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  afterAll(async () => {
    await prisma.pathStep.deleteMany({ where: { path: { userId: testUserId } } });
    await prisma.path.deleteMany({ where: { userId: testUserId } });
    await prisma.skill.deleteMany({ where: { userId: testUserId } });
    await prisma.quest.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear specific data before each test if needed, or rely on afterAll for full cleanup.
    // For this structure, we'll create paths within tests and clean them up.
    await prisma.pathStep.deleteMany({ where: { path: { userId: testUserId } } });
    await prisma.path.deleteMany({ where: { userId: testUserId } });
    mockAuth.mockResolvedValue({ user: { id: testUserId } }); // Ensure auth is set for each test
  });

  describe('POST /api/paths', () => {
    it('should create a new path successfully', async () => {
      const req = createMockRequest({ method: 'POST', body: { name: 'My New Path', description: 'A test path' } });
      const response = await createPath(req);
      expect(response.status).toBe(201);
      const path = await response.json();
      expect(path.name).toBe('My New Path');
      expect(path.description).toBe('A test path');
      expect(path.userId).toBe(testUserId);
    });

    it('should require a name for path creation', async () => {
      const req = createMockRequest({ method: 'POST', body: { description: 'No name path' } });
      const response = await createPath(req);
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.details.name).toBe('Path name is required.');
    });

    it('should return 401 if unauthenticated', async () => {
      mockAuth.mockResolvedValue(null);
      const req = createMockRequest({ method: 'POST', body: { name: 'Auth Test Path' } });
      const response = await createPath(req);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/paths', () => {
    it('should return paths for the authenticated user', async () => {
      await prisma.path.create({ data: { userId: testUserId, name: 'Path 1' } });
      await prisma.path.create({ data: { userId: testUserId, name: 'Path 2' } });
      // Create a path for another user to ensure it's not fetched
      await createTestUser('other-user');
      await prisma.path.create({data: {userId: 'other-user', name: 'Other User Path'}});


      const req = createMockRequest({ method: 'GET' });
      const response = await getPaths(req);
      expect(response.status).toBe(200);
      const paths = await response.json();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBe(2);
      expect(paths[0].userId).toBe(testUserId);
      expect(paths[0]).toHaveProperty('_count');
    });
  });

  describe('GET /api/paths/[pathId]', () => {
    let path: Path;
    beforeEach(async () => {
        path = await prisma.path.create({ data: { userId: testUserId, name: 'Detailed Path' } });
        await prisma.pathStep.create({ data: { pathId: path.id, order: 0, type: PathStepType.SKILL, skillId: testSkill.id }});
        await prisma.pathStep.create({ data: { pathId: path.id, order: 1, type: PathStepType.QUEST, questId: testQuest.id }});
    });

    it('should return a specific path with ordered steps', async () => {
      const req = createMockRequest({ method: 'GET' });
      const response = await getPathById(req, { params: { pathId: path.id } });
      expect(response.status).toBe(200);
      const pathDetails = await response.json();
      expect(pathDetails.id).toBe(path.id);
      expect(pathDetails.steps.length).toBe(2);
      expect(pathDetails.steps[0].order).toBe(0);
      expect(pathDetails.steps[0].skill.name).toBe(testSkill.name);
      expect(pathDetails.steps[1].order).toBe(1);
      expect(pathDetails.steps[1].quest.title).toBe(testQuest.title);
    });

    it('should return 404 if path not found or not owned', async () => {
      const req = createMockRequest({ method: 'GET' });
      let res = await getPathById(req, { params: { pathId: 'non-existent' } });
      expect(res.status).toBe(404);

      mockAuth.mockResolvedValue({ user: { id: 'another-user' } });
      res = await getPathById(req, { params: { pathId: path.id } });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/paths/[pathId]/steps', () => {
    let path: Path;
    beforeEach(async () => {
        path = await prisma.path.create({ data: { userId: testUserId, name: 'Path For Steps' } });
    });

    it('should add a SKILL step to a path', async () => {
        const req = createMockRequest({ method: 'POST', body: { type: PathStepType.SKILL, skillId: testSkill.id, notes: 'Focus here' } });
        const response = await addPathStep(req, { params: { pathId: path.id }});
        expect(response.status).toBe(201);
        const step = await response.json();
        expect(step.type).toBe(PathStepType.SKILL);
        expect(step.skillId).toBe(testSkill.id);
        expect(step.notes).toBe('Focus here');
        expect(step.order).toBe(0); // First step
    });

    it('should return 404 if skillId not owned by user', async () => {
        const otherUserSkill = await prisma.skill.create({ data: { userId: 'other-user-skill-owner', name: 'Other Skill' } });
        const req = createMockRequest({ method: 'POST', body: { type: PathStepType.SKILL, skillId: otherUserSkill.id } });
        const response = await addPathStep(req, { params: { pathId: path.id }});
        expect(response.status).toBe(404); // Or 400 depending on how you want to handle "skill not found for this user"
        await prisma.skill.delete({where: {id: otherUserSkill.id}});
    });
  });

  describe('PATCH /api/paths/[pathId]/steps/[stepId]', () => {
    let path: Path;
    let step: PathStep;
    beforeEach(async () => {
        path = await prisma.path.create({ data: { userId: testUserId, name: 'Path For Step Update' } });
        step = await prisma.pathStep.create({ data: { pathId: path.id, order: 0, type: PathStepType.SKILL, skillId: testSkill.id, completed: false }});
    });

    it('should update a step completed status', async () => {
        const req = createMockRequest({ method: 'PATCH', body: { completed: true } });
        const response = await updatePathStep(req, { params: { pathId: path.id, stepId: step.id }});
        expect(response.status).toBe(200);
        const updatedStep = await response.json();
        expect(updatedStep.completed).toBe(true);
    });

    it('should update a step notes', async () => {
        const req = createMockRequest({ method: 'PATCH', body: { notes: "Updated notes" } });
        const response = await updatePathStep(req, { params: { pathId: path.id, stepId: step.id }});
        expect(response.status).toBe(200);
        const updatedStep = await response.json();
        expect(updatedStep.notes).toBe("Updated notes");
    });

    it('should return 400 if payload is empty', async () => {
        const req = createMockRequest({ method: 'PATCH', body: { } });
        const response = await updatePathStep(req, { params: { pathId: path.id, stepId: step.id }});
        expect(response.status).toBe(400);
    });
  });

});
