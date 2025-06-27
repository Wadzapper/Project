import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, UserAchievement, QuestDependencyType, Skill } from '@prisma/client'; // Added Skill
import { evaluateQuestCompletion } from '@/lib/questUtils';
import { checkAndUnlockAchievements } from '@/lib/achievementUtils';
import { applySkillDecay, SkillWithDecayFields } from '@/lib/skillUtils'; // Import for decay

interface SkillUpdateInput {
  name?: string;
  description?: string;
  currentLevel?: number;
  currentXp?: number;
  targetXpForNextLevel?: number;
  colorCode?: string;
  // Decay fields for PATCH
  decayRate?: number | null;
  decayIntervalDays?: number | null;
  decayEnabled?: boolean;
  // lastDecayCheck is not typically user-settable via PATCH
}

function validateSkillUpdateInput(data: any): { isValid: boolean; errors?: any; data?: SkillUpdateInput } {
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty if provided.' } };
  }
  if (data.decayRate !== undefined && data.decayRate !== null && (typeof data.decayRate !== 'number' || data.decayRate < 0)) {
    return { isValid: false, errors: { decayRate: 'Decay rate must be a non-negative number or null.' } };
  }
  if (data.decayIntervalDays !== undefined && data.decayIntervalDays !== null && (typeof data.decayIntervalDays !== 'number' || data.decayIntervalDays <= 0)) {
    return { isValid: false, errors: { decayIntervalDays: 'Decay interval days must be a positive number or null.' } };
  }
  if (data.decayEnabled !== undefined && typeof data.decayEnabled !== 'boolean') {
     return { isValid: false, errors: { decayEnabled: 'Decay enabled must be a boolean.' } };
  }

  // Enhanced validation: If decay is being enabled, rate and interval must be valid.
  // This check applies if decayEnabled is explicitly true in the payload.
  // If decayEnabled is not in payload, we don't enforce this, allowing partial updates of rate/interval.
  if (data.decayEnabled === true) {
    if (data.decayRate === null || data.decayRate === undefined || data.decayRate <= 0) {
      return { isValid: false, errors: { decayRate: 'Decay Rate must be a positive number when enabling decay.' }};
    }
    if (data.decayIntervalDays === null || data.decayIntervalDays === undefined || data.decayIntervalDays <= 0) {
      return { isValid: false, errors: { decayIntervalDays: 'Decay Interval Days must be a positive number when enabling decay.' }};
    }
  }
  // If decay is being disabled, we might want to nullify rate and interval in the PATCH handler,
  // but the validation here doesn't need to enforce that; client can send them as null.

  return { isValid: true, data: data as SkillUpdateInput };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { skillId } = params;
  try {
    let skill = await prisma.skill.findUnique({ // Make skill mutable
      where: { id: skillId, userId: session.user.id },
    });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found or access denied' }, { status: 404 });
    }
    // Apply decay logic before returning
    skill = await applySkillDecay(skill as SkillWithDecayFields);
    return NextResponse.json(skill);
  } catch (error) {
    console.error(`Error fetching skill ${skillId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch skill' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { skillId } = params;

  let body;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 }); }

  const validation = validateSkillUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  let updatePayload = { ...validation.data };

  // If decay is being disabled, explicitly nullify rate and interval
  if (updatePayload.decayEnabled === false) {
    updatePayload.decayRate = null;
    updatePayload.decayIntervalDays = null;
    // Optionally, could also set lastDecayCheck to null or now, but typically not needed if disabled.
  }

  try {
    const existingSkill = await prisma.skill.findUnique({
      where: { id: skillId, userId: session.user.id },
    });
    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found or access denied' }, { status: 404 });
    }
    const oldSkillValues = { ...existingSkill };

    const transactionResult = await prisma.$transaction(async (tx) => {
      const updatedSkillFromDb = await tx.skill.update({
        where: { id: skillId },
        data: updatePayload, // Use the potentially modified updatePayload
      });

      let xpChange = 0;
      if (updateData.currentXp !== undefined && oldSkillValues.currentXp !== undefined) {
        xpChange = updateData.currentXp - oldSkillValues.currentXp;
      }
      if (xpChange !== 0 || oldSkillValues.currentLevel !== updatedSkillFromDb.currentLevel) {
        await tx.skillProgressLog.create({
          data: {
            skillId: updatedSkillFromDb.id, userId: session.user!.id, xpChange: xpChange,
            newXp: updatedSkillFromDb.currentXp, newLevel: updatedSkillFromDb.currentLevel,
            changeReason: "skill_update_api",
          }
        });
      }

      let newlyUnlockedQuestAchievements: UserAchievement[] = [];

      if (xpChange !== 0 || oldSkillValues.currentLevel !== updatedSkillFromDb.currentLevel) {
        const allUserSkills = await tx.skill.findMany({ where: { userId: session.user!.id } });
        const userSkillsMap = new Map(allUserSkills.map(s => [s.id, s]));
        const affectedQuests = await tx.quest.findMany({
          where: {
            userId: session.user!.id, status: { in: [QuestStatus.PENDING, QuestStatus.IN_PROGRESS] },
            dependencies: { some: { skillId: skillId } },
          },
          include: { dependencies: { include: { skill: true } } },
        });

        for (const quest of affectedQuests) {
          const evalResult = evaluateQuestCompletion(quest as any, userSkillsMap);
          if (evalResult.newQuestStatus !== quest.status || evalResult.updatedDependencies.some((dep, i) => dep.isCompleted !== quest.dependencies[i].isCompleted)) {
              const updatedQuest = await tx.quest.update({ // Capture updated quest
                where: { id: quest.id },
                data: {
                  status: evalResult.newQuestStatus,
                  completedAt: evalResult.newQuestStatus === QuestStatus.COMPLETED && !quest.completedAt ? new Date() : quest.completedAt,
                  failedAt: evalResult.newQuestStatus === QuestStatus.FAILED && !quest.failedAt ? new Date() : quest.failedAt,
                },
                 include: { dependencies: true } // Ensure dependencies are included for eventData
              });
              for (const dep of evalResult.updatedDependencies) {
                const originalDep = quest.dependencies.find(od => od.id === dep.id);
                let progressDataToUpdate: { isCompleted: boolean; currentProgress?: number } = {
                    isCompleted: dep.isCompleted
                };

                if (dep.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE && dep.skillId === skillId && dep.initialSkillXp !== null && dep.initialSkillXp !== undefined) {
                  // Calculate current progress for this specific dependency type
                  const skillForDep = userSkillsMap.get(dep.skillId);
                  if (skillForDep) {
                    progressDataToUpdate.currentProgress = Math.max(0, skillForDep.currentXp - dep.initialSkillXp);
                  }
                } else if (dep.currentProgress !== undefined) { // Persist currentProgress if provided by evalResult for other types
                    progressDataToUpdate.currentProgress = dep.currentProgress;
                }

                if (originalDep && (originalDep.isCompleted !== dep.isCompleted || originalDep.currentProgress !== progressDataToUpdate.currentProgress)) {
                    await tx.questDependency.update({
                        where: { id: dep.id },
                        data: progressDataToUpdate,
                    });
                }
              }
              if (evalResult.newQuestStatus !== quest.status) {
                await tx.questLog.create({
                  data: {
                    questId: quest.id, userId: session.user!.id,
                    statusChange: `STATUS_CHANGED_TO_${evalResult.newQuestStatus}`,
                    details: { reason: "skill_update_trigger", skillId: skillId }
                  }
                });
                if (evalResult.newQuestStatus === QuestStatus.COMPLETED) {
                    const unlocks = await checkAndUnlockAchievements(tx, session.user!.id, "QUEST_COMPLETED", { quest: updatedQuest });
                    newlyUnlockedQuestAchievements.push(...unlocks);
                }
              }
          }
        }
      }
      const newlyUnlockedSkillAchievements = await checkAndUnlockAchievements(tx, session.user!.id, "SKILL_UPDATED", { skill: updatedSkillFromDb });

      return {
        updatedSkill: updatedSkillFromDb,
        unlockedAchievements: [...newlyUnlockedSkillAchievements, ...newlyUnlockedQuestAchievements]
      };
    });

    return NextResponse.json(transactionResult);
  } catch (error: any) {
    console.error(`Error updating skill ${skillId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { skillId } = params;
  try {
    const existingSkill = await prisma.skill.findUnique({
      where: { id: skillId, userId: session.user.id },
    });
    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found or access denied' }, { status: 404 });
    }
    await prisma.skill.delete({ where: { id: skillId } });
    return NextResponse.json({ message: 'Skill deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting skill ${skillId}:`, error);
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 });
  }
}
