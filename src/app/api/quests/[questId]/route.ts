import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType, QuestDependencyType, Skill, UserAchievement, Prisma } from '@prisma/client'; // Added Prisma
import { evaluateQuestCompletion } from '@/lib/questUtils';
import { checkAndUnlockAchievements } from '@/lib/achievementUtils';

interface QuestUpdateInput {
  name?: string; // Changed from title to name to match Prisma model
  description?: string | null; // Made description explicitly nullable to match model
  status?: QuestStatus;
  type?: QuestType;
  dependencyUpdates?: Array<{
    dependencyId: string;
    isCompleted?: boolean;
    currentProgress?: number;
  }>;
  // tagIds removed as Quest model does not have tags field/relation
}

function validateQuestUpdateInput(data: any): { isValid: boolean; errors?: any; data?: QuestUpdateInput } {
  const { name, ...rest } = data;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty if provided.' } };
  }
  if (rest.status !== undefined && !Object.values(QuestStatus).includes(rest.status as QuestStatus)) {
    return { isValid: false, errors: { status: 'Invalid status.' } };
  }
  if (rest.type !== undefined && !Object.values(QuestType).includes(rest.type as QuestType)) {
    return { isValid: false, errors: { type: 'Invalid type.' } };
  }
  // No tagIds validation needed anymore

  const validatedData = { ...rest, name: name }; // Use name
  return { isValid: true, data: validatedData as QuestUpdateInput };
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
      include: {
        dependencies: { include: { skill: { select: { id: true, name: true } } } },
        // Quest model has no 'tags' or 'questTags' relation in current schema
      },
    });
    if (!quest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }
    // Return quest data as is; it doesn't have a separate tags array to flatten
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
  const userId = session.user.id; // userId is guaranteed to be string here
  const { questId } = params;

  let body: QuestUpdateInput;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 }); }

  const validation = validateQuestUpdateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }
  // Removed tagIds from destructuring as it's no longer in QuestUpdateInput
  const { dependencyUpdates, ...otherUpdateData } = validation.data;

  try {
    const existingQuest = await prisma.quest.findUnique({
      where: { id: questId, userId: session.user.id },
      include: { dependencies: true }
    });
    if (!existingQuest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      let questToUpdate = { ...existingQuest };

      // Use Prisma.QuestUpdateInput for type safety
      const questUpdatePayload: Prisma.QuestUpdateInput = {};
      if (otherUpdateData.name !== undefined) questUpdatePayload.name = otherUpdateData.name; // Use name
      if (otherUpdateData.description !== undefined) questUpdatePayload.description = otherUpdateData.description;
      if (otherUpdateData.type !== undefined) questUpdatePayload.type = otherUpdateData.type;
      if (otherUpdateData.status !== undefined) {
        questUpdatePayload.status = otherUpdateData.status;
        if (otherUpdateData.status === QuestStatus.COMPLETED && !existingQuest.completedAt) questUpdatePayload.completedAt = new Date();
        else if (otherUpdateData.status === QuestStatus.FAILED && !existingQuest.failedAt) questUpdatePayload.failedAt = new Date();
        else if (otherUpdateData.status === QuestStatus.PENDING || otherUpdateData.status === QuestStatus.IN_PROGRESS) {
          questUpdatePayload.completedAt = null; questUpdatePayload.failedAt = null;
        }
      }

      if (Object.keys(questUpdatePayload).length > 0) {
        const updatedQuestPartial = await tx.quest.update({
          where: { id: questId }, data: questUpdatePayload,
          include: { dependencies: { include: { skill: true } } }
        });
        questToUpdate = { ...questToUpdate, ...updatedQuestPartial};
        if (otherUpdateData.status && otherUpdateData.status !== existingQuest.status) { // Use otherUpdateData.status which is QuestStatus
            // Corrected QuestLog creation based on schema: status (not statusChange), note (not details), createdAt (not loggedAt)
             await tx.questLog.create({
                data: { questId, userId: userId, status: otherUpdateData.status!, note: `MANUAL_STATUS_TO_${otherUpdateData.status}` } // Used userId and added non-null assertion for status
            });
        }
      }

      if (Object.keys(questUpdatePayload).length === 0 && (dependencyUpdates)) { // Removed tagIds condition
         const currentQuestWithDeps = await tx.quest.findUnique({ // Removed questTags include
            where: {id: questId},
            include: { dependencies: {include: {skill: true}} }
        });
        if (!currentQuestWithDeps) throw new Error("Quest disappeared during transaction");
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
                await tx.questLog.create({ // Corrected QuestLog
                    data: { questId, userId: userId, status: questToUpdate.status!, note: `MANUAL_DEP_CHECK_${depUpdate.isCompleted ? 'COMPLETED' : 'UNCOMPLETED'} - DepID: ${depUpdate.dependencyId}` }  // Used userId and added non-null assertion for status
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
      const userSkillsMap = new Map(allUserSkills.map(s => [s.id, s as Skill]));
      const evalResult = evaluateQuestCompletion(questToUpdate as any, userSkillsMap);
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
        if (evalResult.newQuestStatus !== existingQuest.status) {
             await tx.questLog.create({ // Corrected QuestLog
                data: { questId, userId: userId, status: evalResult.newQuestStatus, note: `STATUS_CHANGED_TO_${evalResult.newQuestStatus} via evaluation` } // Used userId
            });
        }
      }

      if (finalQuestState.status === QuestStatus.COMPLETED && existingQuest.status !== QuestStatus.COMPLETED) {
        newlyUnlockedAchievements = await checkAndUnlockAchievements(tx, userId, "QUEST_COMPLETED", { quest: finalQuestState as any }); // Used userId
      }

      // Tag logic removed as Quest model does not have tags field/relation

      const finalQuestWithDetails = await tx.quest.findUnique({
        where: { id: questId },
        include: {
            dependencies: { include: { skill: true } },
            // questTags removed
        }
      });
      if (!finalQuestWithDetails) throw new Error("Failed to refetch final quest state."); // Corrected variable name

      return { updatedQuest: finalQuestWithDetails, unlockedAchievements: newlyUnlockedAchievements };
    });

    // Response does not need to map tags anymore
    return NextResponse.json({
        ...transactionResult.updatedQuest,
        unlockedAchievements: transactionResult.unlockedAchievements
    });

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
    // Need to delete related QuestDependencies and QuestLogs first if onDelete Cascade is not set or not working as expected
    await prisma.questDependency.deleteMany({ where: { questId: questId }});
    await prisma.questLog.deleteMany({ where: { questId: questId }});
    // QuestTags delete many removed as relation doesn't exist

    await prisma.quest.delete({ where: { id: questId } });
    return NextResponse.json({ message: 'Quest deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting quest ${questId}:`, error);
    return NextResponse.json({ error: 'Failed to delete quest' }, { status: 500 });
  }
}
