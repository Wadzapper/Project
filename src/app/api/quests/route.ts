// src/app/api/quests/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, QuestStatus, QuestPriority } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/quests - Fetch all quests (optionally filtered)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const status = searchParams.get('status') as QuestStatus | null;
  const priority = searchParams.get('priority') as QuestPriority | null;
  const parentQuestId = searchParams.get('parentQuestId'); // To fetch top-level quests or specific sub-quests

  try {
    const whereClause: Prisma.QuestWhereInput = {};
    if (userId) whereClause.userId = userId;
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (parentQuestId === 'null') { // Special value to fetch only top-level quests
      whereClause.parentQuestId = null;
    } else if (parentQuestId) {
      whereClause.parentQuestId = parentQuestId;
    }


    const quests = await prisma.quest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true } },
        relatedSkills: { select: { id: true, name: true } },
        parentQuest: { select: { id: true, title: true } }, // Include parent for context
        subQuests: { select: { id: true, title: true, status: true } }, // Include children for context
        _count: {
          select: { subQuests: true, dependencies: true, dependents: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ],
    });
    return NextResponse.json(quests);
  } catch (error) {
    console.error('Error fetching quests:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/quests - Create a new quest
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId, title, description, status, priority, difficulty, xpReward,
      dueDate, tags, parentQuestId, orderIndex, relatedSkillIds, dependencyIds
    } = body;

    if (!userId || !title) {
      return NextResponse.json({ message: 'Missing required fields: userId, title' }, { status: 400 });
    }

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });

    if (parentQuestId) {
      const parentExists = await prisma.quest.findUnique({ where: { id: parentQuestId }});
      if (!parentExists) return NextResponse.json({ message: `Parent quest with id ${parentQuestId} not found.`}, { status: 404 });
      if (parentExists.userId !== userId) return NextResponse.json({ message: 'Parent quest does not belong to the user.' }, { status: 403 });
    }

    // Validate relatedSkillIds exist and belong to the user
    if (relatedSkillIds && relatedSkillIds.length > 0) {
      const skills = await prisma.skill.findMany({ where: { id: { in: relatedSkillIds }, userId: userId }});
      if (skills.length !== relatedSkillIds.length) {
        return NextResponse.json({ message: 'One or more related skills not found or do not belong to the user.' }, { status: 400 });
      }
    }

    // Validate dependencyIds exist and belong to the user
    if (dependencyIds && dependencyIds.length > 0) {
      const quests = await prisma.quest.findMany({ where: { id: { in: dependencyIds }, userId: userId }});
      if (quests.length !== dependencyIds.length) {
        return NextResponse.json({ message: 'One or more dependency quests not found or do not belong to the user.' }, { status: 400 });
      }
    }

    const createData: Prisma.QuestCreateInput = {
      user: { connect: { id: userId } },
      title,
      description,
      status: status || QuestStatus.TODO,
      priority: priority || QuestPriority.MEDIUM,
      difficulty,
      xpReward,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags,
      orderIndex,
    };

    if (parentQuestId) {
      createData.parentQuest = { connect: { id: parentQuestId } };
    }
    if (relatedSkillIds && relatedSkillIds.length > 0) {
      createData.relatedSkills = { connect: relatedSkillIds.map((id: string) => ({ id })) };
    }
    // Dependencies are more complex, usually created via QuestDependency model.
    // For simplicity, creating dependencies directly on quest creation might be limited.
    // Here, we'll assume dependencyIds are for quests that THIS quest depends on.
    if (dependencyIds && dependencyIds.length > 0) {
        createData.dependencies = {
           create: dependencyIds.map((depId: string) => ({ dependsOn: { connect: { id: depId } } }))
        }
    }


    const newQuest = await prisma.quest.create({
      data: createData,
      include: {
        user: { select: { id: true, username: true } },
        relatedSkills: true,
        parentQuest: true,
        dependencies: { include: { dependsOn: true } },
        dependents: { include: { quest: true } },
      }
    });
    return NextResponse.json(newQuest, { status: 201 });
  } catch (error) {
    console.error('Error creating quest:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
