// src/app/api/paths/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string; // Path ID
  };
}

// GET /api/paths/[id] - Fetch a single path with its steps
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const path = await prisma.path.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        steps: {
          orderBy: { order: 'asc' }, // Order steps
          include: { // Include details of related skill or quest for each step
            relatedSkill: { select: { id: true, name: true, level: true } },
            relatedQuest: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (!path) {
      return NextResponse.json({ message: 'Path not found' }, { status: 404 });
    }

    // Augment path with progress percentage
    const totalSteps = path.steps.length;
    const completedSteps = path.steps.filter(step => step.completed).length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return NextResponse.json({
        ...path,
        totalSteps,
        completedSteps,
        progressPercentage
    });

  } catch (error) {
    console.error(`Error fetching path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/paths/[id] - Edit path properties
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, description, color } = body;

    // Ensure there's something to update
    if (title === undefined && description === undefined && color === undefined) {
      return NextResponse.json({ message: 'No update data provided.' }, { status: 400 });
    }

    const updateData: Prisma.PathUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    const updatedPath = await prisma.path.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        steps: { orderBy: { order: 'asc' } }, // Return updated path with steps
      },
    });

    // Augment with progress
    const totalSteps = updatedPath.steps.length;
    const completedSteps = updatedPath.steps.filter(step => step.completed).length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return NextResponse.json({
        ...updatedPath,
        totalSteps,
        completedSteps,
        progressPercentage
    });

  } catch (error) {
    console.error(`Error updating path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Path not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/paths/[id] - Delete a path and its steps
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    // Prisma's onDelete: Cascade on Path -> PathStep[] relation handles step deletion.
    // Need to ensure this is set in the schema.
    // (Checked schema: PathStep.path relation has onDelete: Cascade)
    await prisma.path.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Path and its steps deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting path ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Path not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
