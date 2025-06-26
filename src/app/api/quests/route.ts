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
      // Add more specific validation per dependency type here if needed
      if ((dep.type === 'SKILL_LEVEL_REACHED' || dep.type === 'SKILL_XP_GAINED_TOTAL') && !dep.skillId) {
        return { isValid: false, errors: { dependencies: `Skill ID is required for ${dep.type}` }};
      }
    }
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
  let statusFilter: QuestStatus | undefined = undefined;

  if (statusParam && Object.values(QuestStatus).includes(statusParam as QuestStatus)) {
    statusFilter = statusParam as QuestStatus;
  }

  try {
    const quests = await prisma.quest.findMany({
      where: {
        userId: session.user.id,
        ...(statusFilter && { status: statusFilter }) // Apply status filter if valid
      },
      include: {
        dependencies: true, // Include dependencies for list view context
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(quests);
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

  const { name, description, type, dependencies } = validation.data;

  try {
    // Need to handle dependency creation more carefully if we need to fetch initialSkillXp
    const newQuest = await prisma.$transaction(async (tx) => {
      const createdQuest = await tx.quest.create({
        data: {
          userId: session.user.id,
          name,
          description: description || null,
          type,
          status: QuestStatus.PENDING,
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
              // Handle error: skill not found or not owned by user
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
      // Re-fetch the quest with its dependencies to return the full object
      return tx.quest.findUnique({
        where: { id: createdQuest.id },
        include: {
          dependencies: true,
        }
      });
    });

    if (!newQuest) { // Should not happen if transaction is successful
        throw new Error("Quest creation failed after transaction.");
    }

    return NextResponse.json(newQuest, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quest:', error);
    return NextResponse.json({ error: error.message || 'Failed to create quest' }, { status: 500 });
  }
}
        dependencies: true, // Return the created quest with its dependencies
      }
    });
    return NextResponse.json(newQuest, { status: 201 });
  } catch (error) {
    console.error('Error creating quest:', error);
    return NextResponse.json({ error: 'Failed to create quest' }, { status: 500 });
  }
}
