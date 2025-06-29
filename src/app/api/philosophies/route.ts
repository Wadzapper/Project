// src/app/api/philosophies/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/philosophies?userId=<userId> - Fetch philosophy for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId' }, { status: 400 });
  }

  try {
    const philosophy = await prisma.userPhilosophy.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    if (!philosophy) {
      return NextResponse.json({ message: 'User philosophy not found for this user.' }, { status: 404 });
    }
    return NextResponse.json(philosophy);
  } catch (error) {
    console.error(`Error fetching philosophy for user ${userId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/philosophies - Create or update (upsert) a user's philosophy
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, coreValues, mission, vision, quotes } = body;

    if (!userId) {
      return NextResponse.json({ message: 'Missing required field: userId' }, { status: 400 });
    }

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });
    }

    const createData: Prisma.UserPhilosophyCreateInput = {
        user: { connect: { id: userId } },
        coreValues: coreValues || [],
        mission,
        vision,
        quotes,
    };

    const updateData: Prisma.UserPhilosophyUpdateInput = {
        coreValues: coreValues || [],
        mission,
        vision,
        quotes,
    };


    const philosophy = await prisma.userPhilosophy.upsert({
      where: { userId },
      create: createData,
      update: updateData,
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(philosophy, { status: philosophy.createdAt.getTime() === philosophy.updatedAt.getTime() ? 201 : 200 });
  } catch (error) {
    console.error('Error creating/updating user philosophy:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target === 'UserPhilosophy_userId_key') { // Should not happen with upsert logic for userId
        return NextResponse.json({ message: 'Concurrency issue or unexpected unique constraint violation.' }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}


// PUT /api/philosophies?userId=<userId> - Update a user's philosophy (similar to POST due to unique userId)
export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId for PUT' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // userId from body should match userId from query, or not be present in body if query param is authoritative
    if (body.userId && body.userId !== userId) {
        return NextResponse.json({ message: 'User ID in body does not match User ID in query parameter.' }, { status: 400 });
    }

    const { coreValues, mission, vision, quotes } = body;

    const updateData: Prisma.UserPhilosophyUpdateInput = {};
    if (coreValues !== undefined) updateData.coreValues = coreValues;
    if (mission !== undefined) updateData.mission = mission;
    if (vision !== undefined) updateData.vision = vision;
    if (quotes !== undefined) updateData.quotes = quotes;


    const updatedPhilosophy = await prisma.userPhilosophy.update({
      where: { userId },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(updatedPhilosophy);
  } catch (error) {
    console.error(`Error updating philosophy for user ${userId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'User philosophy not found for this user to update.' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/philosophies?userId=<userId> - Delete a user's philosophy
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId' }, { status: 400 });
  }

  try {
    await prisma.userPhilosophy.delete({
      where: { userId },
    });
    return NextResponse.json({ message: 'User philosophy deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting philosophy for user ${userId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'User philosophy not found for this user to delete.' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
