import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType, QuestDependencyType } from '@prisma/client'; // Import enums

// Basic validation (can be expanded or use Zod)
interface QuestDependencyInput {
  type: QuestDependencyType;
  description?: string;
  skillId?: string;
  targetSkillLevel?: number;
  targetSkillXp?: number;
  targetDate?: string; // ISO date string
  // currentProgress: 0, // Defaulted in schema or by logic
  // isCompleted: false, // Defaulted in schema
}

interface QuestInput {
  name: string;
  description?: string;
  type: QuestType;
  dependencies?: QuestDependencyInput[];
  tagIds?: string[]; // Added for tags
}

function validateQuestInput(data: QuestInput): { isValid: boolean; errors?: any; data?: QuestInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  if (!data.type || !Object.values(QuestType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid quest type.' } };
  }
  if (data.dependencies) {
    for (const dep of data.dependencies) {
      if (!dep.type || !Object.values(QuestDependencyType).includes(dep.type)) {
        return { isValid: false, errors: { dependencies: `Invalid dependency type: ${dep.type}` } };
      }
      if ((dep.type === QuestDependencyType.SKILL_TARGET_LEVEL || dep.type === QuestDependencyType.SKILL_XP_GAINED_TOTAL || dep.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE) && !dep.skillId) {
        return { isValid: false, errors: { dependencies: `Skill ID is required for skill-based dependency type ${dep.type}` }};
      }
    }
  }
  if (data.tagIds !== undefined && (!Array.isArray(data.tagIds) || !data.tagIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { tagIds: 'tagIds must be an array of strings.' } };
  }
  return { isValid: true, data };
}


// GET /api/quests - Get all quests for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');
  const tagIdsParam = searchParams.get('tagIds');
  const skillIdsParam = searchParams.get('skillIds');
  const isChainedParam = searchParams.get('isChained'); // "true" or "false"

  const whereClause: any = { userId: session.user.id };

  if (statusParam && Object.values(QuestStatus).includes(statusParam as QuestStatus)) {
    whereClause.status = statusParam as QuestStatus;
  } else if (statusParam?.toUpperCase() === 'ALL') {
    // No status filter, fetch all
  } else if (!statusParam) {
    // Default to IN_PROGRESS if no status is provided, as per original logic
    // whereClause.status = QuestStatus.IN_PROGRESS;
    // Or remove default to truly fetch all if no status is specified.
    // For now, let's keep the "ALL" or specific status logic. If no status, no filter by it.
  }


  if (tagIdsParam) {
    const tagIdsArray = tagIdsParam.split(',').filter(id => id.trim() !== '');
    if (tagIdsArray.length > 0) {
      // Filter for quests that have at least one of the specified tags (OR logic)
      whereClause.questTags = { some: { tagId: { in: tagIdsArray } } };
    }
  }

  if (skillIdsParam) {
    const skillIdsArray = skillIdsParam.split(',').filter(id => id.trim() !== '');
    if (skillIdsArray.length > 0) {
      // Filter for quests that have a dependency on at least one of the specified skills
      whereClause.dependencies = { some: { skillId: { in: skillIdsArray } } };
    }
  }

  if (isChainedParam === 'true') {
    whereClause.parentQuestId = { not: null };
  } else if (isChainedParam === 'false') {
    whereClause.parentQuestId = null;
  }
  // If isChainedParam is not 'true' or 'false', no filter on parentQuestId is applied.

  try {
    const quests = await prisma.quest.findMany({
      where: whereClause,
      include: {
        dependencies: { include: { skill: { select: { id: true, name: true } } } }, // Also include skill name in dependency
        questTags: { // Include linked tags
          select: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const questsWithTags = quests.map(quest => {
      const { questTags, dependencies, ...questData } = quest;
      return {
        ...questData,
        // Map dependencies to include skill name if skill exists
        dependencies: dependencies.map(dep => ({
            ...dep,
            skillName: dep.skill?.name // Add skillName if skill is populated
        })),
        tags: questTags.map(qt => qt.tag)
      };
    });

    return NextResponse.json(questsWithTags);
  } catch (error) {
    console.error('Error fetching quests:', error);
    return NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 });
  }
}

// POST /api/quests - Create a new quest for the authenticated user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: QuestInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateQuestInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description, type, dependencies, tagIds } = validation.data; // Added tagIds

  try {
    // Validate tagIds if provided
    if (tagIds && tagIds.length > 0) {
      const tagsExistCount = await prisma.tag.count({
        where: {
          id: { in: tagIds },
          userId: session.user.id, // Ensure tags belong to the user
        },
      });
      if (tagsExistCount !== tagIds.length) {
        return NextResponse.json({ error: 'One or more provided tag IDs are invalid or do not belong to the user.' }, { status: 400 });
      }
    }

    const newQuestWithDetails = await prisma.$transaction(async (tx) => {
      const createdQuest = await tx.quest.create({
        data: {
          userId: session.user.id,
          name, // Use title from input
          title: name, // Prisma model uses 'title', QuestInput used 'name'. Aligning.
          description: description || null,
          type,
          status: QuestStatus.PENDING,
          // Handle tags connection
          questTags: tagIds && tagIds.length > 0
            ? {
                create: tagIds.map(tagId => ({
                  tagId: tagId,
                  assignedBy: session.user.id!,
                })),
              }
            : undefined,
        },
      });

      if (dependencies && dependencies.length > 0) {
        for (const depInput of dependencies) {
          let initialSkillXpForDep: number | undefined = undefined;
          if (depInput.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE && depInput.skillId) {
            const skill = await tx.skill.findUnique({ where: { id: depInput.skillId, userId: session.user!.id } });
            if (skill) {
              initialSkillXpForDep = skill.currentXp;
            } else {
              throw new Error(`Skill with ID ${depInput.skillId} not found for relative XP dependency.`);
            }
          }
          await tx.questDependency.create({
            data: {
              questId: createdQuest.id,
              type: depInput.type,
              description: depInput.description,
              skillId: depInput.skillId,
              initialSkillXp: initialSkillXpForDep,
              targetSkillLevel: depInput.targetSkillLevel,
              targetSkillXp: depInput.targetSkillXp,
              targetDate: depInput.targetDate ? new Date(depInput.targetDate) : undefined,
              currentProgress: 0,
              isCompleted: false,
            }
          });
        }
      }
      // Re-fetch the quest with its dependencies and tags to return the full object
      return tx.quest.findUnique({
        where: { id: createdQuest.id },
        include: {
          dependencies: true,
          questTags: { include: { tag: true } }
        }
      });
    });

    if (!newQuestWithDetails) {
        throw new Error("Quest creation failed after transaction.");
    }

    const { questTags, ...questData } = newQuestWithDetails;
    const responseData = {
        ...questData,
        tags: questTags.map(qt => qt.tag)
    };

    return NextResponse.json(responseData, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quest:', error);
    return NextResponse.json({ error: 'Failed to create quest' }, { status: 500 });
  }
}
