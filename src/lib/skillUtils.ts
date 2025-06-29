// src/lib/skillUtils.ts
import { Skill as PrismaSkill } from '@prisma/client';

// Define a more specific type for the skill object expected by the function,
// ensuring all necessary fields for decay calculation are present.
export interface SkillForDecay extends Omit<PrismaSkill, 'createdAt' | 'updatedAt' | 'lastDecay'> {
  createdAt: Date; // Ensure Date type
  updatedAt: Date; // Ensure Date type
  lastDecay: Date | null; // Ensure Date type or null
  // userId, name, description, xp, level, maxLevel, category, tags,
  // decayRate, decayIntervalDays, decayEnabled, skillTreeId
}

export interface SkillDecayResult {
  effectiveXp: number;
  effectiveLevel: number;
  needsDbUpdate: boolean; // Flag indicating if the database record *should* be updated
  lastDecayApplicable: Date | null; // The most recent date a decay event *could* have occurred
}

// Assumption: XP to Level formula
export const getLevelFromXp = (xp: number, baseXpPerLevel: number = 100): number => {
  if (xp < 0) xp = 0;
  return Math.floor(xp / baseXpPerLevel) + 1;
};

export const getXpForLevel = (level: number, baseXpPerLevel: number = 100): number => {
  if (level <= 1) return 0;
  return (level - 1) * baseXpPerLevel;
};


export const calculateSkillDecay = (
  skill: SkillForDecay,
  currentDate: Date = new Date()
): SkillDecayResult => {
  let {
    xp,
    level,
    decayEnabled,
    decayRate,
    decayIntervalDays,
    lastDecay,
    createdAt,
    maxLevel
  } = skill;

  const initialXp = xp;
  const initialLevel = level;
  let newLastDecayApplicable: Date | null = lastDecay;
  let needsDbUpdate = false;

  if (!decayEnabled || !decayRate || decayRate <= 0 || !decayIntervalDays || decayIntervalDays <= 0) {
    return {
        effectiveXp: xp,
        effectiveLevel: level,
        needsDbUpdate: false,
        lastDecayApplicable: lastDecay
    };
  }

  const referenceDate = lastDecay || createdAt;
  const timeDiffMs = currentDate.getTime() - referenceDate.getTime();
  const daysPassed = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));

  if (daysPassed < decayIntervalDays) {
    return {
        effectiveXp: xp,
        effectiveLevel: level,
        needsDbUpdate: false,
        lastDecayApplicable: lastDecay
    };
  }

  const numberOfDecayCycles = Math.floor(daysPassed / decayIntervalDays);
  let currentEffectiveXp = xp;
  let lastDecayCycleDate = new Date(referenceDate.getTime());

  for (let i = 0; i < numberOfDecayCycles; i++) {
    // Calculate XP loss for this cycle
    // Decay rate is a percentage of current XP.
    const xpToLose = currentEffectiveXp * decayRate;
    currentEffectiveXp -= xpToLose;

    // Update the date for this decay cycle application
    lastDecayCycleDate.setDate(lastDecayCycleDate.getDate() + decayIntervalDays);
  }

  // Ensure XP doesn't go below 0 or what's needed for level 1
  const minXpForLevel1 = getXpForLevel(1);
  if (currentEffectiveXp < minXpForLevel1) {
    currentEffectiveXp = minXpForLevel1;
  }
  currentEffectiveXp = Math.floor(currentEffectiveXp); // Often XP is integer

  let currentEffectiveLevel = getLevelFromXp(currentEffectiveXp);
  if (currentEffectiveLevel < 1) {
    currentEffectiveLevel = 1;
  }
  if (maxLevel && currentEffectiveLevel > maxLevel) {
      currentEffectiveLevel = maxLevel;
      // Cap XP to max XP for that level if needed, though decay usually reduces XP.
      // currentEffectiveXp = getXpForLevel(maxLevel +1) -1 ; // or similar logic
  }


  if (currentEffectiveXp !== initialXp || currentEffectiveLevel !== initialLevel) {
    needsDbUpdate = true; // Indicates that the skill's state has changed due to decay
  }

  // The new "lastDecay" should be the date of the last successfully applied decay cycle.
  // If numberOfDecayCycles > 0, then lastDecayCycleDate holds this.
  newLastDecayApplicable = numberOfDecayCycles > 0 ? lastDecayCycleDate : lastDecay;


  return {
    effectiveXp: currentEffectiveXp,
    effectiveLevel: currentEffectiveLevel,
    needsDbUpdate,
    lastDecayApplicable: newLastDecayApplicable,
  };
};
