// src/app/api/paths/[id]/steps/[stepId]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string;     // Path ID
    stepId: string; // PathStep ID
  };
}

// PATCH /api/paths/[id]/steps/[stepId] - Update a specific step
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id: pathId, stepId } = params;
    const body = await request.json();
    const { title, description, order, relatedSkillId, relatedQuestId, completed } = body;

    // Validate step exists and belongs to the path
    const step = await prisma.pathStep.findUnique({
      where: { id: stepId, pathId: pathId },
      include: { path: true } // To get userId for validation
    });
    if (!step) {
      return NextResponse.json({ message: `Step with ID ${stepId} not found in path ${pathId}.` }, { status: 404 });
    }
    const userId = step.path.userId;


    const updateData: Prisma.PathStepUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) {
        // If order is changing, ensure new order isn't taken by another step in the same path
        if (order !== step.order) {
            const existingStepWithOrder = await prisma.pathStep.findFirst({
                where: { pathId, order, id: { not: stepId } } // Check other steps
            });
            if (existingStepWithOrder) {
                return NextResponse.json({ message: `Order ${order} is already taken by another step in this path.` }, { status: 409 });
            }
        }
        updateData.order = order;
    }
    if (completed !== undefined) {
        updateData.completed = completed;
        if (completed === true && step.completed === false) {
            updateData.completedAt = new Date(); // Set completion timestamp
        } else if (completed === false) {
            updateData.completedAt = null; // Clear completion timestamp
        }
    }


    if (relatedSkillId !== undefined) {
      if (relatedSkillId === null) { // Allow unsetting
        updateData.relatedSkill = { disconnect: true };
      } else {
        const skill = await prisma.skill.findUnique({ where: { id: relatedSkillId, userId: userId } });
        if (!skill) return NextResponse.json({ message: `Skill with ID ${relatedSkillId} not found or does not belong to user.` }, { status: 400 });
        updateData.relatedSkill = { connect: { id: relatedSkillId } };
      }
    }

    if (relatedQuestId !== undefined) {
      if (relatedQuestId === null) { // Allow unsetting
        updateData.relatedQuest = { disconnect: true };
      } else {
        const quest = await prisma.quest.findUnique({ where: { id: relatedQuestId, userId: userId } });
        if (!quest) return NextResponse.json({ message: `Quest with ID ${relatedQuestId} not found or does not belong to user.` }, { status: 400 });
        updateData.relatedQuest = { connect: { id: relatedQuestId } };
      }
    }

    if (Object.keys(updateData).length === 0) {
        // Return current step if no actual update data provided
        const currentStep = await prisma.pathStep.findUnique({
            where: { id: stepId },
            include: {
                relatedSkill: { select: { id: true, name: true } },
                relatedQuest: { select: { id: true, title: true } }
            }
        });
        return NextResponse.json(currentStep);
    }


    const updatedStep = await prisma.pathStep.update({
      where: { id: stepId },
      data: updateData,
      include: {
        relatedSkill: { select: { id: true, name: true } },
        relatedQuest: { select: { id: true, title: true } },
      }
    });

    return NextResponse.json(updatedStep);
  } catch (error) {
    console.error(`Error updating step ${params.stepId} for path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found (should be caught by initial step check)
        return NextResponse.json({ message: 'Step not found' }, { status: 404 });
      }
      if (error.code === 'P2002' && error.meta?.target === 'pathOrder') {
         return NextResponse.json({ message: `A step with order value already exists in this path.` }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/paths/[id]/steps/[stepId] - Delete a specific step
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id: pathId, stepId } = params;

    // Validate step exists and belongs to the path before deleting
    const stepExists = await prisma.pathStep.findUnique({
      where: { id: stepId, pathId: pathId },
    });
    if (!stepExists) {
      return NextResponse.json({ message: `Step with ID ${stepId} not found in path ${pathId}.` }, { status: 404 });
    }

    await prisma.pathStep.delete({
      where: { id: stepId },
    });

    return NextResponse.json({ message: 'Step deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting step ${params.stepId} for path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Step not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
