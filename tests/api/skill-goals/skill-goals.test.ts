// Summary: Tests for Skill Goal API Endpoints, focusing on auto-completion.
// TODO: Add tests for input validation on POST/PATCH (e.g., negative targetXP).
// TODO: Add tests for DELETE operation.

import { GET as getSkillGoals, POST as createSkillGoal } from '@/app/api/skill-goals/route';
import { PATCH as updateSkillGoal, DELETE as deleteSkillGoal } from '@/app/api/skill-goals/[goalId]/route';

import { createMockRequest } from '@/tests/api/helpers';
import * as AuthModule from 'next-auth';
import { prisma } from '@/lib/db';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { User, Skill, SkillGoal } from '@prisma/client';

const mockAuth = vi.spyOn(AuthModule, 'auth');
const testUserId = 'skill-goal-user';
let testUser: User;
let testSkill: Skill;

describe('Skill Goal API Endpoints - Auto-Completion Logic', () => {
  beforeAll(async () => {
    testUser = await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: { id: testUserId, name: 'Skill Goal User', email: 'skillgoal@example.com' },
    });
  });

  beforeEach(async () => {
    // Clean slate for skill and goals before each test
    await prisma.skillGoal.deleteMany({ where: { userId: testUserId } });
    await prisma.skill.deleteMany({ where: { userId: testUserId } });
    testSkill = await prisma.skill.create({
      data: { userId: testUserId, name: 'Test Skill for Goals', currentLevel: 1, currentXp: 50, targetXpForNextLevel: 100 },
    });
    mockAuth.mockResolvedValue({ user: { id: testUserId } });
  });

  afterAll(async () => {
    await prisma.skillGoal.deleteMany({ where: { userId: testUserId } });
    await prisma.skill.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    vi.restoreAllMocks();
  });

  describe('POST /api/skill-goals', () => {
    it('should create a goal as complete if targetXP is already met', async () => {
      const goalData = { skillId: testSkill.id, targetXP: 40, notes: 'Already met goal' };
      const req = createMockRequest({ method: 'POST', body: goalData });
      const response = await createSkillGoal(req);
      expect(response.status).toBe(201);
      const newGoal: SkillGoal = await response.json();
      expect(newGoal.isComplete).toBe(true);
      expect(newGoal.completedAt).not.toBeNull();
    });

    it('should create a goal as incomplete if targetXP is not met', async () => {
      const goalData = { skillId: testSkill.id, targetXP: 200, notes: 'Future goal' };
      const req = createMockRequest({ method: 'POST', body: goalData });
      const response = await createSkillGoal(req);
      expect(response.status).toBe(201);
      const newGoal: SkillGoal = await response.json();
      expect(newGoal.isComplete).toBe(false);
      expect(newGoal.completedAt).toBeNull();
    });
  });

  describe('GET /api/skill-goals (List with Auto-Completion)', () => {
    it('should auto-complete an existing goal if skill XP meets targetXP on read', async () => {
      // Create an incomplete goal
      const goal = await prisma.skillGoal.create({
        data: { userId: testUserId, skillId: testSkill.id, targetXP: 100, isComplete: false },
      });
      expect(goal.isComplete).toBe(false);

      // Update skill's XP in DB to meet the goal
      await prisma.skill.update({ where: { id: testSkill.id }, data: { currentXp: 120 } });

      const req = createMockRequest({ method: 'GET' });
      const response = await getSkillGoals(req);
      expect(response.status).toBe(200);
      const goals: SkillGoalWithSkill[] = await response.json();

      const updatedGoal = goals.find(g => g.id === goal.id);
      expect(updatedGoal).toBeDefined();
      expect(updatedGoal?.isComplete).toBe(true);
      expect(updatedGoal?.completedAt).not.toBeNull();
      // Verify the skill's currentXp is also returned correctly
      expect(updatedGoal?.skill.currentXp).toBe(120);
    });
  });

  interface SkillGoalWithSkill extends SkillGoal { // Local type for test clarity
    skill: Pick<Skill, 'name' | 'currentXp' | 'currentLevel'>;
  }


  describe('PATCH /api/skill-goals/[goalId]', () => {
    let goal: SkillGoal;
    beforeEach(async () => {
        // Reset skill XP and create a standard incomplete goal
        testSkill = await prisma.skill.update({ where: {id: testSkill.id}, data: { currentXp: 50 }});
        goal = await prisma.skillGoal.create({
            data: { userId: testUserId, skillId: testSkill.id, targetXP: 150, isComplete: false },
        });
    });

    it('should auto-complete goal if targetXP is updated to be <= skill.currentXp', async () => {
      const req = createMockRequest({ method: 'PATCH', body: { targetXP: 50 } }); // currentXP is 50
      const response = await updateSkillGoal(req, { params: { goalId: goal.id } });
      expect(response.status).toBe(200);
      const updatedGoal: SkillGoal = await response.json();
      expect(updatedGoal.isComplete).toBe(true);
      expect(updatedGoal.completedAt).not.toBeNull();
    });

    it('should mark goal as complete and set completedAt if isComplete:true is passed', async () => {
      const req = createMockRequest({ method: 'PATCH', body: { isComplete: true } });
      const response = await updateSkillGoal(req, { params: { goalId: goal.id } });
      expect(response.status).toBe(200);
      const updatedGoal: SkillGoal = await response.json();
      expect(updatedGoal.isComplete).toBe(true);
      expect(updatedGoal.completedAt).not.toBeNull();
    });

    it('should mark goal as incomplete and nullify completedAt if isComplete:false is passed', async () => {
      // First, complete it
      await prisma.skillGoal.update({ where: {id: goal.id}, data: { isComplete: true, completedAt: new Date() }});

      const req = createMockRequest({ method: 'PATCH', body: { isComplete: false } });
      const response = await updateSkillGoal(req, { params: { goalId: goal.id } });
      expect(response.status).toBe(200);
      const updatedGoal: SkillGoal = await response.json();
      expect(updatedGoal.isComplete).toBe(false);
      expect(updatedGoal.completedAt).toBeNull();
    });

    it('should not auto-complete if isComplete:false is explicitly passed, even if XP meets target', async () => {
        await prisma.skill.update({ where: { id: testSkill.id }, data: { currentXp: 200 } }); // XP meets target 150
        const req = createMockRequest({ method: 'PATCH', body: { isComplete: false } }); // Explicitly setting to false
        const response = await updateSkillGoal(req, { params: { goalId: goal.id } });
        expect(response.status).toBe(200);
        const updatedGoal: SkillGoal = await response.json();
        expect(updatedGoal.isComplete).toBe(false); // Should respect explicit false
    });
  });
});
