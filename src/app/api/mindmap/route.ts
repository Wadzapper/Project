// src/app/api/mindmap/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/mindmap - Fetch all mind maps for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId' }, { status: 400 });
  }

  try {
    const mindMaps = await prisma.mindMap.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, username: true } },
        _count: {
          select: { nodes: true, edges: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(mindMaps);
  } catch (error) {
    console.error(`Error fetching mind maps for user ${userId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/mindmap - Create a new mind map
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, description, isPublic, layout } = body;

    if (!userId || !name) {
      return NextResponse.json({ message: 'Missing required fields: userId, name' }, { status: 400 });
    }

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });
    }

    const newMindMap = await prisma.mindMap.create({
      data: {
        user: { connect: { id: userId } },
        name,
        description,
        isPublic,
        layout, // JSON field for layout info
      },
      include: {
        user: { select: { id: true, username: true } },
      }
    });
    return NextResponse.json(newMindMap, { status: 201 });
  } catch (error) {
    console.error('Error creating mind map:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
