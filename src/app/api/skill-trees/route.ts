// src/app/api/skill-trees/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/skill-trees - Fetch all skill trees (optionally filtered by userId)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    const skillTrees = await prisma.skillTree.findMany({
      where: userId ? { userId } : {},
      include: {
        user: { select: { id: true, username: true } },
        _count: { // Count of skills in each tree for summary
          select: { skills: true }
        }
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return NextResponse.json(skillTrees);
  } catch (error) {
    console.error('Error fetching skill trees:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/skill-trees - Create a new skill tree
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, description, isPublic, category, nodes } = body;

    if (!userId || !name) {
      return NextResponse.json({ message: 'Missing required fields: userId, name' }, { status: 400 });
    }

    // Validate if user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });
    }

    const newSkillTree = await prisma.skillTree.create({
      data: {
        userId,
        name,
        description,
        isPublic,
        category,
        nodes, // Assuming nodes is a JSON structure for react-flow etc.
      },
       include: {
        user: { select: { id: true, username: true } },
      }
    });
    return NextResponse.json(newSkillTree, { status: 201 });
  } catch (error) {
    console.error('Error creating skill tree:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: if (error.code === 'P2002' && error.meta?.target?.includes('name') && error.meta?.target?.includes('userId')) {
      //   return NextResponse.json({ message: 'Skill tree name already exists for this user' }, { status: 409 });
      // }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
