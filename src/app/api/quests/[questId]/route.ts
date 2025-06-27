import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType, QuestDependencyType, Skill, UserAchievement } from '@prisma/client'; // Added Skill, UserAchievement
import { evaluateQuestCompletion } from '@/lib/questUtils';
import { checkAndUnlockAchievements } from '@/lib/achievementUtils';

interface QuestUpdateInput {
  name?: string;
  description?: string;
  name?: string; // This should probably be 'title' to match Prisma model
  title?: string;
  description?: string;
  status?: QuestStatus;
  type?: QuestType;
  dependencyUpdates?: Array<{
    dependencyId: string;
    isCompleted?: boolean;
    currentProgress?: number;
  }>;
  tagIds?: string[]; // Added for tags
}

function validateQuestUpdateInput(data: any): { isValid: boolean; errors?: any; data?: QuestUpdateInput } {
  const { name, title, ...rest } = data; // Handle potential name/title ambiguity
  const effectiveTitle = title || name;

  if (effectiveTitle !== undefined && (typeof effectiveTitle !== 'string' || effectiveTitle.trim().length === 0)) {
    return { isValid: false, errors: { title: 'Title cannot be empty.' } };
  }
  if (rest.status !== undefined && !Object.values(QuestStatus).includes(rest.status as QuestStatus)) {
    return { isValid: false, errors: { status: 'Invalid status.' } };
  }
  if (rest.type !== undefined && !Object.values(QuestType).includes(rest.type as QuestType)) {
    return { isValid: false, errors: { type: 'Invalid type.' } };
  }
  if (rest.tagIds !== undefined && (!Array.isArray(rest.tagIds) || !rest.tagIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { tagIds: 'tagIds must be an array of strings.' } };
  }
  // Reconstruct data with effectiveTitle if name was used
  const validatedData = { ...rest, title: effectiveTitle };
  if (name && !title) validatedData.title = name; // Prefer title, but accept name
  if (name !== undefined) delete (validatedData as any).name; // Remove 'name' if it existed to avoid conflict with 'title'

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
        questTags: { // Include linked tags
          select: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      },
    });
    if (!quest) {
      return NextResponse.json({ error: 'Quest not found or access denied' }, { status: 404 });
    }

    const { questTags, ...questData } = quest;
    const responseData = {
      ...questData,
      tags: questTags.map(qt => qt.tag)
    };
    return NextResponse.json(responseData);
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
  const { tagIds, dependencyUpdates, ...otherUpdateData } = validation.data; // Separate tagIds

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

      const questUpdatePayload: Prisma.QuestUpdateInput = {};
      if (otherUpdateData.title !== undefined) questUpdatePayload.title = otherUpdateData.title;
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
        questToUpdate = { ...questToUpdate, ...updatedQuestPartial}; // Merge basic field updates
        if (questUpdatePayload.status && questUpdatePayload.status !== existingQuest.status) {
            await tx.questLog.create({
                data: { questId, userId: session.user!.id, statusChange: `MANUAL_STATUS_TO_${questUpdatePayload.status}`, loggedAt: new Date() }
            });
        }
      }
      // If only tags or dependencies are changing, questToUpdate remains existingQuest for eval
      // Re-fetch with full includes if only deps/tags changed to ensure eval gets latest
      if (Object.keys(questUpdatePayload).length === 0 && (dependencyUpdates || tagIds !== undefined)) {
         const currentQuestWithDepsAndTags = await tx.quest.findUnique({
            where: {id: questId},
            include: {
                dependencies: {include: {skill: true}},
                questTags: {include: {tag: true}}
            }
        });
        if (!currentQuestWithDepsAndTags) throw new Error("Quest disappeared during transaction");
        questToUpdate = currentQuestWithDepsAndTags;
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

      // Handle tagIds sync if provided
      if (tagIds !== undefined) {
        if (tagIds.length > 0) {
            const tagsExistCount = await tx.tag.count({
                where: { id: { in: tagIds }, userId: session.user!.id }
            });
            if (tagsExistCount !== tagIds.length) {
                throw new Error('One or more provided tag IDs for update are invalid or do not belong to the user.');
            }
        }
        await tx.questTag.deleteMany({ where: { questId: questId } });
        if (tagIds.length > 0) {
          await tx.questTag.createMany({
            data: tagIds.map(tagId => ({
              questId: questId,
              tagId: tagId,
              assignedBy: session.user!.id!,
            })),
          });
        }
      }

      // Refetch the final quest state with all includes for the response
      const finalQuestWithAllDetails = await tx.quest.findUnique({
        where: { id: questId },
        include: {
            dependencies: { include: { skill: true } },
            questTags: { include: { tag: true } }
        }
      });
      if (!finalQuestWithAllDetails) throw new Error("Failed to refetch final quest state.");

      return { updatedQuest: finalQuestWithAllDetails, unlockedAchievements: newlyUnlockedAchievements };
    });

    // Map to desired response structure (flatten tags)
    const { questTags: finalQuestTags, ...finalQuestData } = transactionResult.updatedQuest;
    const responseData = {
        ...finalQuestData,
        tags: finalQuestTags.map(qt => qt.tag),
        unlockedAchievements: transactionResult.unlockedAchievements
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error(`Error updating quest ${questId}:`, error);
    if (error.message.includes('tag IDs for update are invalid')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
