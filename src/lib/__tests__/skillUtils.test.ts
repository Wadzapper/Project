import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db'; // Actual prisma client
import { applySkillDecay, SkillWithDecayFields, calculateTargetXpForLevel, calculateLevelUp } from '../skillUtils'; // Adjust path as needed
import { Skill, SkillProgressLog } from '@prisma/client';
import { subDays, addDays } from 'date-fns';

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    skill: {
      update: vi.fn(),
    },
    skillProgressLog: {
      create: vi.fn(),
    },
  },
}));

const mockPrismaSkillUpdate = prisma.skill.update as ReturnType<typeof vi.fn>;
const mockPrismaSkillProgressLogCreate = prisma.skillProgressLog.create as ReturnType<typeof vi.fn>;

describe('applySkillDecay', () => {
  const baseSkill: Omit<SkillWithDecayFields, 'id' | 'userId' | 'name' | 'description' | 'colorCode' | 'targetXpForNextLevel' | 'updatedAt' | 'skillTreeNodes' | 'questDependencies' | 'progressLogs'> & {userId: string} = {
    userId: 'test-user',
    currentLevel: 2,
    currentXp: 150, // Example: Level 2 might be 150-299 XP if L1=150XP, L2=300XP (using calcTargetXpForLevel(1) = 150)
    createdAt: subDays(new Date(), 100), // Created long ago
    decayEnabled: true,
    decayRate: 10,
    decayIntervalDays: 7,
    lastDecayCheck: null, // Will be varied in tests
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for successful update
    mockPrismaSkillUpdate.mockImplementation(async ({ where, data }: any) => {
      // Return the updated skill data
      return { ...baseSkill, id: where.id, ...data } as Skill;
    });
    mockPrismaSkillProgressLogCreate.mockResolvedValue({} as SkillProgressLog); // Doesn't need specific return value for these tests
  });

  it('should not apply decay if decayEnabled is false', async () => {
    const skill: SkillWithDecayFields = { ...baseSkill, id: 'skill1', decayEnabled: false, lastDecayCheck: subDays(new Date(), 30) };
    const result = await applySkillDecay(skill);
    expect(result).toEqual(skill);
    expect(mockPrismaSkillUpdate).not.toHaveBeenCalled();
    expect(mockPrismaSkillProgressLogCreate).not.toHaveBeenCalled();
  });

  it('should not apply decay if decayRate or decayIntervalDays are invalid', async () => {
    let skill: SkillWithDecayFields = { ...baseSkill, id: 'skill1', decayRate: 0, lastDecayCheck: subDays(new Date(), 30) };
    let result = await applySkillDecay(skill);
    expect(result).toEqual(skill);

    skill = { ...baseSkill, id: 'skill1', decayIntervalDays: 0, lastDecayCheck: subDays(new Date(), 30) };
    result = await applySkillDecay(skill);
    expect(result).toEqual(skill);

    skill = { ...baseSkill, id: 'skill1', decayRate: null, lastDecayCheck: subDays(new Date(), 30) };
    result = await applySkillDecay(skill);
    expect(result).toEqual(skill);

    expect(mockPrismaSkillUpdate).not.toHaveBeenCalled();
  });

  it('should not apply decay if not enough time has passed since lastDecayCheck', async () => {
    const skill: SkillWithDecayFields = { ...baseSkill, id: 'skill1', lastDecayCheck: subDays(new Date(), skill.decayIntervalDays! - 1) };
    const result = await applySkillDecay(skill);
    expect(result).toEqual(skill); // No change expected
    expect(mockPrismaSkillUpdate).not.toHaveBeenCalled(); // Or called only to update lastDecayCheck if that logic is active for non-decay scenarios
  });

  it('should apply decay correctly for one interval passed', async () => {
    const initialXp = 150;
    const decayRate = 10;
    const interval = 7;
    const lastCheck = subDays(new Date(), interval); // Exactly one interval ago
    const skill: SkillWithDecayFields = { ...baseSkill, id: 'skill-decay-one', currentXp: initialXp, decayRate, decayIntervalDays: interval, lastDecayCheck: lastCheck };

    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, currentXp: initialXp - decayRate, lastDecayCheck: expect.any(Date) });

    const result = await applySkillDecay(skill);

    expect(mockPrismaSkillUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith({
      where: { id: skill.id },
      data: {
        currentXp: initialXp - decayRate,
        lastDecayCheck: expect.any(Date), // Should be 'now'
      },
    });
    expect(result.currentXp).toBe(initialXp - decayRate);
    expect(mockPrismaSkillProgressLogCreate).toHaveBeenCalledWith({
      data: {
        skillId: skill.id,
        userId: skill.userId,
        xpChange: -decayRate,
        newXp: initialXp - decayRate,
        newLevel: skill.currentLevel, // Level doesn't change
        changeReason: "DECAY",
      }
    });
  });

  it('should apply decay correctly for multiple intervals passed', async () => {
    const initialXp = 150;
    const decayRate = 10;
    const interval = 7;
    const intervalsPassed = 3;
    const lastCheck = subDays(new Date(), interval * intervalsPassed + 2); // 3 full intervals ago + 2 days
    const skill: SkillWithDecayFields = { ...baseSkill, id: 'skill-decay-multi', currentXp: initialXp, decayRate, decayIntervalDays: interval, lastDecayCheck: lastCheck };

    const expectedDecayAmount = intervalsPassed * decayRate;
    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, currentXp: initialXp - expectedDecayAmount, lastDecayCheck: expect.any(Date) });

    const result = await applySkillDecay(skill);

    expect(mockPrismaSkillUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith({
      where: { id: skill.id },
      data: {
        currentXp: initialXp - expectedDecayAmount,
        lastDecayCheck: expect.any(Date),
      },
    });
    expect(result.currentXp).toBe(initialXp - expectedDecayAmount);
    expect(mockPrismaSkillProgressLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        xpChange: -expectedDecayAmount,
        newXp: initialXp - expectedDecayAmount,
    }));
  });

  it('should not let XP drop below 0 due to decay', async () => {
    const initialXp = 5;
    const decayRate = 10;
    const interval = 7;
    const lastCheck = subDays(new Date(), interval);
    const skill: SkillWithDecayFields = { ...baseSkill, id: 'skill-decay-to-zero', currentXp: initialXp, decayRate, decayIntervalDays: interval, lastDecayCheck: lastCheck };

    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, currentXp: 0, lastDecayCheck: expect.any(Date) });

    const result = await applySkillDecay(skill);

    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { currentXp: 0 } }));
    expect(result.currentXp).toBe(0);
    expect(mockPrismaSkillProgressLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        xpChange: -initialXp, // XP change is only what was lost
        newXp: 0,
    }));
  });

  it('should use createdAt as effectiveLastCheck if lastDecayCheck is null and skill is old enough', async () => {
    const interval = 7;
    const skillCreationDate = subDays(new Date(), interval * 2); // Created 2 intervals ago
    const skill: SkillWithDecayFields = {
        ...baseSkill,
        id: 'skill-decay-from-created',
        createdAt: skillCreationDate,
        lastDecayCheck: null,
        decayIntervalDays: interval,
        currentXp: 100,
        decayRate: 10
    };
    const expectedDecayAmount = 2 * 10; // 2 intervals
    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, currentXp: 100 - expectedDecayAmount, lastDecayCheck: expect.any(Date) });

    await applySkillDecay(skill);
    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentXp: 100 - expectedDecayAmount, lastDecayCheck: expect.any(Date) },
    }));
  });

  it('should update lastDecayCheck to now if skill is new and lastDecayCheck is null (first pass)', async () => {
    const skillCreationDate = subDays(new Date(), 1); // Created yesterday
    const skill: SkillWithDecayFields = {
        ...baseSkill,
        id: 'skill-new-no-decay-yet',
        createdAt: skillCreationDate,
        lastDecayCheck: null,
        decayIntervalDays: 7, // Interval not passed yet
        currentXp: 100
    };
    // This part of applySkillDecay was: if (!skill.lastDecayCheck && skill.createdAt >= subDays(now,1) )
    // The logic in applySkillDecay for this case:
    // If lastDecayCheck is null and skill created recently (e.g. within 1 day), it updates lastDecayCheck to now.
    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, lastDecayCheck: expect.any(Date) });

    const result = await applySkillDecay(skill);

    // Expect only lastDecayCheck to be updated, no XP change
    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith({
        where: { id: skill.id },
        data: { lastDecayCheck: expect.any(Date) },
    });
    expect(result.currentXp).toBe(skill.currentXp); // No XP change
    expect(mockPrismaSkillProgressLogCreate).not.toHaveBeenCalled();
  });

  it('should update lastDecayCheck even if XP does not change (e.g. XP already 0)', async () => {
    const interval = 7;
    const lastCheck = subDays(new Date(), interval * 2); // Eligible for decay
    const skill: SkillWithDecayFields = {
        ...baseSkill,
        id: 'skill-decay-xp-zero',
        currentXp: 0,
        decayRate: 10,
        decayIntervalDays: interval,
        lastDecayCheck: lastCheck
    };
    mockPrismaSkillUpdate.mockResolvedValueOnce({ ...skill, lastDecayCheck: expect.any(Date) });

    const result = await applySkillDecay(skill);
    expect(mockPrismaSkillUpdate).toHaveBeenCalledWith({
        where: {id: skill.id},
        data: {lastDecayCheck: expect.any(Date) }
    });
    expect(result.currentXp).toBe(0);
    expect(mockPrismaSkillProgressLogCreate).not.toHaveBeenCalled(); // No XP change, so no log
  });

  // Test for calculateTargetXpForLevel (example)
  describe('calculateTargetXpForLevel', () => {
    it('calculates target XP correctly', () => {
      expect(calculateTargetXpForLevel(1)).toBe(150); // (1*100) + 50*1
      expect(calculateTargetXpForLevel(2)).toBe(300); // (2*100) + 50*2
      expect(calculateTargetXpForLevel(3)).toBe(450); // (3*100) + 50*3
    });
  });

  // Test for calculateLevelUp (example)
  describe('calculateLevelUp', () => {
    it('levels up correctly', () => {
        const initialInfo = { currentLevel: 1, currentXp: 100, targetXpForNextLevel: calculateTargetXpForLevel(1) }; // Target for L1 is 150
        const afterLevelUp = calculateLevelUp(initialInfo, 70); // 100 + 70 = 170. Should level up to L2.
        expect(afterLevelUp.currentLevel).toBe(2);
        expect(afterLevelUp.currentXp).toBe(170 - 150); // 20 XP into Level 2
        expect(afterLevelUp.targetXpForNextLevel).toBe(calculateTargetXpForLevel(2)); // Target for L2 is 300
    });
  });

});
