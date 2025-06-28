import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType, QuestDependencyType, Prisma } from '@prisma/client'; // Import enums and Prisma

// Basic validation (can be expanded or use Zod)
interface QuestDependencyInput {
  type: QuestDependencyType;
  description?: string;
  skillId?: string;
  targetSkillLevel?: number;
  targetSkillXp?: number;
  targetDate?: string; // ISO date string
}

interface QuestInput {
  name: string; // Changed from title to name to match Prisma model
  description?: string;
  type: QuestType;
  dependencies?: QuestDependencyInput[];
  // tagIds removed as Quest model has no tags
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
      // Corrected SKILL_TARGET_LEVEL to SKILL_LEVEL_REACHED
      if ((dep.type === QuestDependencyType.SKILL_LEVEL_REACHED || dep.type === QuestDependencyType.SKILL_XP_GAINED_TOTAL || dep.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE) && !dep.skillId) {
        return { isValid: false, errors: { dependencies: `Skill ID is required for skill-based dependency type ${dep.type}` }};
      }
    }
  }
  // tagIds validation removed
  return { isValid: true, data };
}


// GET /api/quests - Get all quests for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');
  // tagIdsParam removed
  const skillIdsParam = searchParams.get('skillIds'); // Corrected from skillId to skillIdsParam
  const isChainedParam = searchParams.get('isChained');

  const whereClause: Prisma.QuestWhereInput = { userId: userId }; // Use Prisma.QuestWhereInput for type safety

  if (statusParam && Object.values(QuestStatus).includes(statusParam as QuestStatus)) {
    whereClause.status = statusParam as QuestStatus;
  } else if (statusParam?.toUpperCase() === 'ALL') {
    // No status filter
  } // If no statusParam, no filter on status by default

  // tagIdsParam logic removed

  if (skillIdsParam) {
    const skillIdsArray = skillIdsParam.split(',').filter(id => id.trim() !== '');
    if (skillIdsArray.length > 0) {
      whereClause.dependencies = { some: { skillId: { in: skillIdsArray } } };
    }
  }

  // parentQuestId does not exist on Quest model, removing this filter logic
  // if (isChainedParam === 'true') {
  //   whereClause.parentQuestId = { not: null };
  // } else if (isChainedParam === 'false') {
  //   whereClause.parentQuestId = null;
  // }

  try {
    const quests = await prisma.quest.findMany({
      where: whereClause,
      include: {
        dependencies: { include: { skill: { select: { id: true, name: true } } } },
        // questTags removed
      },
      orderBy: { createdAt: 'desc' },
    });

    // Adjust mapping as questTags are removed
    const responseData = quests.map(quest => {
      const { dependencies, ...questData } = quest; // Removed questTags from destructuring
      return {
        ...questData,
        dependencies: dependencies.map(dep => ({
            ...dep,
            skillName: dep.skill?.name
        })),
        // tags: [] // Quest model doesn't have tags, return empty or omit
      };
    });

    return NextResponse.json(responseData);
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
  const userId = session.user.id;

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

  const { name, description, type, dependencies } = validation.data; // Removed tagIds

  try {
    // tagIds validation and linking logic removed

    const newQuestWithDetails = await prisma.$transaction(async (tx) => {
      const createdQuest = await tx.quest.create({
        data: {
          userId: userId,
          name, // Prisma model uses 'name'
          description: description || null,
          type,
          status: QuestStatus.PENDING,
          // questTags logic removed
        },
      });

      if (dependencies && dependencies.length > 0) {
        for (const depInput of dependencies) {
          let initialSkillXpForDep: number | undefined = undefined;
          // Corrected SKILL_TARGET_LEVEL to SKILL_LEVEL_REACHED
          if ((depInput.type === QuestDependencyType.SKILL_LEVEL_REACHED || depInput.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE) && depInput.skillId) {
            const skill = await tx.skill.findUnique({ where: { id: depInput.skillId, userId: userId } });
            if (skill) {
              if (depInput.type === QuestDependencyType.SKILL_XP_GAINED_RELATIVE) {
                 initialSkillXpForDep = skill.currentXp;
              }
            } else {
              throw new Error(`Skill with ID ${depInput.skillId} not found for dependency.`);
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
      return tx.quest.findUnique({
        where: { id: createdQuest.id },
        include: {
          dependencies: true,
          // questTags removed
        }
      });
    });

    if (!newQuestWithDetails) {
        throw new Error("Quest creation failed after transaction.");
    }

    // Adjust response as questTags are removed
    const { ...questData } = newQuestWithDetails;
    const responseData = {
        ...questData,
        // tags: [] // Quest model doesn't have tags
    };


    return NextResponse.json(responseData, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quest:', error);
    return NextResponse.json({ error: 'Failed to create quest', details: error.message }, { status: 500 });
  }
}
