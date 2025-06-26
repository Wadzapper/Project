import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType, QuestDependencyType, Skill, UserAchievement } from '@prisma/client'; // Added Skill, UserAchievement
import { evaluateQuestCompletion } from '@/lib/questUtils';
import { checkAndUnlockAchievements } from '@/lib/achievementUtils';

interface QuestUpdateInput {
  name?: string;
  description?: string;
  status?: QuestStatus;
  type?: QuestType;
  dependencyUpdates?: Array<{
    dependencyId: string;
    isCompleted?: boolean;
    currentProgress?: number;
  }>;
}

function validateQuestUpdateInput(data: any): { isValid: boolean; errors?: any; data?: QuestUpdateInput } {
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty.' } };
  }
  if (data.status !== undefined && !Object.values(QuestStatus).includes(data.status as QuestStatus)) {
    return { isValid: false, errors: { status: 'Invalid status.' } };
  }
  if (data.type !== undefined && !Object.values(QuestType).includes(data.type as QuestType)) {
    return { isValid: false, errors: { type: 'Invalid type.' } };
  }
  return { isValid: true, data: data as QuestUpdateInput };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { questId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { questId } = params;
  try {
    const quest = await prisma.quest.findUnique({
      where: { id: questId, userId: session.user.id },
      include: { dependencies: { include: { skill: { select: { id: true, name: true } } } } },
    });
    if (!quest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(quest);
  } catch (error) {
    console.error(`Error fetching quest ${questId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { questId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { questId } = params;

  let body: QuestUpdateInput;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 }); }

  const validation = validateQuestUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }
  const { name, description, status, type, dependencyUpdates } = validation.data;

  try {
    const existingQuest = await prisma.quest.findUnique({
      where: { id: questId, userId: session.user.id },
      include: { dependencies: true } // include dependencies for comparison later
    });
    if (!existingQuest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      let questToUpdate = { ...existingQuest }; // Work with a mutable copy

      const questUpdatePayload: Prisma.QuestUpdateInput = {}; // Use Prisma type for safety
      if (name !== undefined) questUpdatePayload.name = name;
      if (description !== undefined) questUpdatePayload.description = description;
      if (type !== undefined) questUpdatePayload.type = type;
      if (status !== undefined) {
        questUpdatePayload.status = status;
        if (status === QuestStatus.COMPLETED && !existingQuest.completedAt) questUpdatePayload.completedAt = new Date();
        else if (status === QuestStatus.FAILED && !existingQuest.failedAt) questUpdatePayload.failedAt = new Date();
        else if (status === QuestStatus.PENDING || status === QuestStatus.IN_PROGRESS) {
          questUpdatePayload.completedAt = null; questUpdatePayload.failedAt = null;
        }
      }

      if (Object.keys(questUpdatePayload).length > 0) {
        questToUpdate = await tx.quest.update({
          where: { id: questId }, data: questUpdatePayload,
          include: { dependencies: { include: { skill: true } } }
        });
        if (questUpdatePayload.status && questUpdatePayload.status !== existingQuest.status) {
            await tx.questLog.create({
                data: { questId, userId: session.user!.id, statusChange: `MANUAL_STATUS_TO_${questUpdatePayload.status}`, loggedAt: new Date() }
            });
        }
      } else {
        // Fetch full dependencies if not already updated
        const currentQuestWithDeps = await tx.quest.findUnique({ where: {id: questId}, include: {dependencies: {include: {skill: true}}}});
        if (!currentQuestWithDeps) throw new Error("Quest disappeared during transaction"); // Should not happen
        questToUpdate = currentQuestWithDeps;
      }

      let manualDepsChanged = false;
      if (dependencyUpdates && dependencyUpdates.length > 0) {
        for (const depUpdate of dependencyUpdates) {
          const depToModify = questToUpdate.dependencies.find(d => d.id === depUpdate.dependencyId);
          if (depToModify && depToModify.type === QuestDependencyType.MANUAL_CHECK) {
            if (depToModify.isCompleted !== depUpdate.isCompleted) {
                await tx.questDependency.update({ where: { id: depUpdate.dependencyId }, data: { isCompleted: depUpdate.isCompleted }});
                manualDepsChanged = true;
                await tx.questLog.create({
                    data: { questId, userId: session.user!.id, statusChange: `MANUAL_DEP_CHECK_${depUpdate.isCompleted ? 'COMPLETED' : 'UNCOMPLETED'}`, details: { dependencyId: depUpdate.dependencyId, dependencyType: depToModify.type }}
                });
            }
          }
        }
        if (manualDepsChanged) {
            const refetchedQuest = await tx.quest.findUnique({ where: { id: questId }, include: { dependencies: { include: { skill: true } } }});
            if (!refetchedQuest) throw new Error("Quest disappeared after dep update");
            questToUpdate = refetchedQuest;
        }
      }

      const allUserSkills = await tx.skill.findMany({ where: { userId: session.user!.id } });
      const userSkillsMap = new Map(allUserSkills.map(s => [s.id, s as Skill])); // Cast to Skill type
      const evalResult = evaluateQuestCompletion(questToUpdate as any, userSkillsMap); // Cast needed for QuestWithDetails
      let finalQuestState = questToUpdate;
      let newlyUnlockedAchievements: UserAchievement[] = [];

      if (evalResult.newQuestStatus !== questToUpdate.status || manualDepsChanged) {
        finalQuestState = await tx.quest.update({
          where: { id: questId },
          data: {
            status: evalResult.newQuestStatus,
            completedAt: evalResult.newQuestStatus === QuestStatus.COMPLETED && !questToUpdate.completedAt ? new Date() : questToUpdate.completedAt,
            failedAt: evalResult.newQuestStatus === QuestStatus.FAILED && !questToUpdate.failedAt ? new Date() : questToUpdate.failedAt,
          },
          include: { dependencies: { include: { skill: {select: {id: true, name: true, currentLevel: true, currentXp: true, targetXpForNextLevel: true, description: true}}} } }
        });

        for (const dep of evalResult.updatedDependencies) {
          const originalDep = questToUpdate.dependencies.find(od => od.id === dep.id);
          if (originalDep && originalDep.isCompleted !== dep.isCompleted) {
            await tx.questDependency.update({ where: { id: dep.id }, data: { isCompleted: dep.isCompleted, currentProgress: dep.currentProgress }});
          }
        }
        if (evalResult.newQuestStatus !== existingQuest.status) { // Compare with original status before any updates in this transaction
             await tx.questLog.create({
                data: { questId, userId: session.user!.id, statusChange: `STATUS_CHANGED_TO_${evalResult.newQuestStatus}`, details: { reason: "quest_patch_api_evaluation" }}
            });
        }
      }

      if (finalQuestState.status === QuestStatus.COMPLETED && existingQuest.status !== QuestStatus.COMPLETED) {
        newlyUnlockedAchievements = await checkAndUnlockAchievements(tx, session.user!.id, "QUEST_COMPLETED", { quest: finalQuestState as any });
      }

      return { updatedQuest: finalQuestState, unlockedAchievements: newlyUnlockedAchievements };
    });

    return NextResponse.json(transactionResult);
  } catch (error: any) {
    console.error(`Error updating quest ${questId}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update quest' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { questId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { questId } = params;
  try {
    const existingQuest = await prisma.quest.findUnique({
      where: { id: questId, userId: session.user.id },
    });
    if (!existingQuest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }
    await prisma.quest.delete({ where: { id: questId } });
    return NextResponse.json({ message: 'Quest deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting quest ${questId}:`, error);
    return NextResponse.json({ error: 'Failed to delete quest' }, { status: 500 });
  }
}
