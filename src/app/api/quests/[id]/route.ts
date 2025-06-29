// src/app/api/quests/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, QuestStatus, QuestPriority } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/quests/[id] - Fetch a single quest by ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const quest = await prisma.quest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        relatedSkills: { select: { id: true, name: true, level: true } },
        dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } }, // Quests this quest depends on
        dependents: { include: { quest: { select: { id: true, title: true, status: true } } } },     // Quests that depend on this quest
        parentQuest: { select: { id: true, title: true } },
        subQuests: { // Children in a chain
          orderBy: { orderIndex: 'asc' },
          select: { id: true, title: true, status: true, orderIndex: true }
        },
        recurring: true,
      },
    });

    if (!quest) {
      return NextResponse.json({ message: 'Quest not found' }, { status: 404 });
    }
    return NextResponse.json(quest);
  } catch (error) {
    console.error(`Error fetching quest ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/quests/[id] - Update a quest by ID
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      title, description, status, priority, difficulty, xpReward,
      dueDate, completedAt, tags, parentQuestId, orderIndex,
      relatedSkillIds, // Array of skill IDs to connect/disconnect
      dependencyIds,   // Array of quest IDs that this quest depends on
      notes, estimatedTime, actualTime
    } = body;

    const questToUpdate = await prisma.quest.findUnique({ where: {id}});
    if(!questToUpdate) {
        return NextResponse.json({ message: 'Quest not found for update.' }, { status: 404 });
    }
    const userId = questToUpdate.userId; // Keep the original userId

    const updateData: Prisma.QuestUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status as QuestStatus;
    if (priority !== undefined) updateData.priority = priority as QuestPriority;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (xpReward !== undefined) updateData.xpReward = xpReward;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (tags !== undefined) updateData.tags = tags;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (notes !== undefined) updateData.notes = notes;
    if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime;
    if (actualTime !== undefined) updateData.actualTime = actualTime;


    if (parentQuestId !== undefined) {
      if (parentQuestId === null) {
        updateData.parentQuest = { disconnect: true };
      } else {
        const parentExists = await prisma.quest.findUnique({ where: { id: parentQuestId }});
        if (!parentExists) return NextResponse.json({ message: `Parent quest with id ${parentQuestId} not found.`}, { status: 404 });
        if (parentExists.userId !== userId) return NextResponse.json({ message: 'Parent quest does not belong to the user.' }, { status: 403 });
        if (parentQuestId === id) return NextResponse.json({ message: 'Quest cannot be its own parent.' }, { status: 400 }); // Prevent self-parenting
        updateData.parentQuest = { connect: { id: parentQuestId } };
      }
    }

    // Handle related skills (set: replaces all existing relations)
    if (relatedSkillIds !== undefined) {
      if (relatedSkillIds.length > 0) {
        const skills = await prisma.skill.findMany({ where: { id: { in: relatedSkillIds }, userId: userId }});
        if (skills.length !== relatedSkillIds.length) {
          return NextResponse.json({ message: 'One or more related skills not found or do not belong to the user for update.' }, { status: 400 });
        }
        updateData.relatedSkills = { set: relatedSkillIds.map((skillId: string) => ({ id: skillId })) };
      } else { // Empty array means disconnect all skills
        updateData.relatedSkills = { set: [] };
      }
    }

    // Handle dependencies (set: replaces all existing dependencies for this quest)
    // This manages the QuestDependency entries where this quest is `questId`.
    if (dependencyIds !== undefined) {
        // First, remove existing dependencies for this quest
        await prisma.questDependency.deleteMany({ where: { questId: id }});
        // Then, create new ones if any
        if (dependencyIds.length > 0) {
            const quests = await prisma.quest.findMany({ where: { id: { in: dependencyIds }, userId: userId }});
            if (quests.length !== dependencyIds.length) {
                return NextResponse.json({ message: 'One or more dependency quests not found or do not belong to the user for update.' }, { status: 400 });
            }
            // Check for circular dependencies (simplistic check: cannot depend on self)
            if (dependencyIds.includes(id)) {
                return NextResponse.json({ message: 'Quest cannot depend on itself.' }, { status: 400 });
            }
            updateData.dependencies = {
                create: dependencyIds.map((depId: string) => ({ dependsOn: { connect: { id: depId } } }))
            };
        }
    }


    const updatedQuest = await prisma.quest.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        relatedSkills: true,
        dependencies: { include: { dependsOn: true } },
        dependents: { include: { quest: true } },
        parentQuest: true,
        subQuests: true,
      },
    });

    return NextResponse.json(updatedQuest);
  } catch (error) {
    console.error(`Error updating quest ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Quest not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/quests/[id] - Delete a quest by ID
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    // Before deleting, check if this quest is a parent to any subQuests.
    // If so, Prisma by default (onDelete: SetNull for parentQuestId in Quest model) will set their parentQuestId to null.
    // Also, check dependencies:
    // - If other quests depend on THIS quest (it's in QuestDependency.dependsOnId), Prisma might prevent deletion
    //   or handle it based on onDelete rule for QuestDependency.dependsOn. (Currently Cascade)
    // - If THIS quest depends on others (it's in QuestDependency.questId), these links will be removed. (Currently Cascade)

    const questToDelete = await prisma.quest.findUnique({
        where: {id},
        include: { dependents: true, subQuests: true }
    });

    if (!questToDelete) {
        return NextResponse.json({ message: 'Quest not found' }, { status: 404 });
    }

    // If strict=true, prevent deletion if it's a dependency for others.
    // if (questToDelete.dependents.length > 0) {
    //    return NextResponse.json({ message: 'Cannot delete quest. Other quests depend on it. Please remove dependencies first.' }, { status: 400 });
    // }

    // Prisma will handle cascading deletes for QuestDependency records where this quest is either `questId` or `dependsOnId`
    // because both sides of the QuestDependency relation to Quest have `onDelete: Cascade`.
    // Prisma will also handle subQuests by setting their `parentQuestId` to NULL due to `onDelete: SetNull` on the `parentQuest` field.

    await prisma.quest.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Quest deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting quest ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Quest not found' }, { status: 404 });
      }
      // P2003 can occur if a relation is Restrict and there are linked records.
      // Given current schema, cascades should handle most cases.
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
