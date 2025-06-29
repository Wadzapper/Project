// src/app/api/skill-trees/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/skill-trees/[id] - Fetch a single skill tree by ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const skillTree = await prisma.skillTree.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        skills: { // Include associated skills
          orderBy: { name: 'asc' }
        },
      },
    });

    if (!skillTree) {
      return NextResponse.json({ message: 'Skill tree not found' }, { status: 404 });
    }
    return NextResponse.json(skillTree);
  } catch (error) {
    console.error(`Error fetching skill tree ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/skill-trees/[id] - Update a skill tree by ID
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, description, isPublic, category, nodes } = body;

    // Ensure user is not trying to change userId
    if (body.userId) {
        return NextResponse.json({ message: 'Cannot change ownership (userId) of a skill tree.' }, { status: 400 });
    }

    const updateData: Prisma.SkillTreeUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (category !== undefined) updateData.category = category;
    if (nodes !== undefined) updateData.nodes = nodes; // Assuming nodes is a JSON for react-flow

    const updatedSkillTree = await prisma.skillTree.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        skills: true,
      },
    });

    return NextResponse.json(updatedSkillTree);
  } catch (error) {
    console.error(`Error updating skill tree ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Skill tree not found' }, { status: 404 });
      }
      // Add P2002 if name needs to be unique per user for skill trees
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/skill-trees/[id] - Delete a skill tree by ID
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    // The Prisma schema's User model has `skillTrees SkillTree[]` (no explicit onDelete).
    // The SkillTree model has `userId String, user User @relation(...)`.
    // The Skill model has `skillTreeId String?, skillTree SkillTree? @relation(...)`.
    // This means deleting a SkillTree will NOT cascade delete Skills by default.
    // Skills associated with this SkillTree will have their `skillTreeId` set to null if the relation is optional.
    // If `Skill.skillTreeId` was mandatory, Prisma would prevent deletion if skills were still linked.
    // Current schema: `skillTreeId String?` so it's optional.

    // Transaction to ensure atomicity if we were doing more complex logic like also deleting orphaned skills
    // For now, simple delete is fine.
    const deletedSkillTree = await prisma.skillTree.delete({
      where: { id },
    });

    // Note: Associated skills are NOT deleted due to schema design (skillTreeId is optional on Skill).
    // Their skillTreeId field will become null.
    // If cascade delete of skills was desired, it would need to be set in schema or handled manually here.

    return NextResponse.json({ message: 'Skill tree deleted successfully. Associated skills have been unlinked.' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting skill tree ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Skill tree not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
