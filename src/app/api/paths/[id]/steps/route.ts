// src/app/api/paths/[id]/steps/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string; // Path ID
  };
}

// POST /api/paths/[id]/steps - Add a new step to a path
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const pathId = params.id;
    const body = await request.json();
    const { title, description, order, relatedSkillId, relatedQuestId, completed } = body;

    if (!title || order === undefined) {
      return NextResponse.json({ message: 'Missing required fields: title, order' }, { status: 400 });
    }

    // Validate path exists and belongs to an authenticated user (userId check would be here in real auth)
    const path = await prisma.path.findUnique({ where: { id: pathId } });
    if (!path) {
      return NextResponse.json({ message: `Path with ID ${pathId} not found.` }, { status: 404 });
    }
    const userId = path.userId; // Use userId from the path for validation of related entities

    // Validate relatedSkillId if provided
    if (relatedSkillId) {
      const skill = await prisma.skill.findUnique({ where: { id: relatedSkillId, userId: userId } });
      if (!skill) {
        return NextResponse.json({ message: `Skill with ID ${relatedSkillId} not found or does not belong to the user.` }, { status: 400 });
      }
    }

    // Validate relatedQuestId if provided
    if (relatedQuestId) {
      const quest = await prisma.quest.findUnique({ where: { id: relatedQuestId, userId: userId } });
      if (!quest) {
        return NextResponse.json({ message: `Quest with ID ${relatedQuestId} not found or does not belong to the user.` }, { status: 400 });
      }
    }

    // Check for order conflict (@@unique([pathId, order]))
    // This will be caught by Prisma, but explicit check can provide a clearer error.
    // const existingStepWithOrder = await prisma.pathStep.findUnique({
    //   where: { pathOrder: { pathId, order } }
    // });
    // if (existingStepWithOrder) {
    //   return NextResponse.json({ message: `A step with order ${order} already exists in this path. Please adjust other step orders or choose a new order.` }, { status: 409 });
    // }


    const newStep = await prisma.pathStep.create({
      data: {
        pathId,
        title,
        description,
        order,
        relatedSkillId,
        relatedQuestId,
        completed: completed || false,
      },
      include: { // Include details for the response
        relatedSkill: { select: { id: true, name: true } },
        relatedQuest: { select: { id: true, title: true } },
      }
    });

    return NextResponse.json(newStep, { status: 201 });
  } catch (error) {
    console.error(`Error creating step for path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target === 'pathOrder') { // From @@unique([pathId, order], name: "pathOrder")
         return NextResponse.json({ message: `A step with order ${error.meta?.modelName /* should be order value from body */ } already exists in this path. Please use a unique order value.` }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
