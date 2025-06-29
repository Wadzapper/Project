// src/app/api/paths/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/paths - List all paths for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Query parameter "userId" is required.' }, { status: 400 });
  }

  try {
    const paths = await prisma.path.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, username: true } },
        steps: { // Include steps for progress calculation, can be limited to counts
          select: {
            id: true,
            completed: true,
          },
        },
        // _count: { // Alternative: get counts directly if full step data isn't needed for list view
        //   select: { steps: true }
        // }
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Augment paths with progress percentage
    const pathsWithProgress = paths.map(path => {
      const totalSteps = path.steps.length;
      const completedSteps = path.steps.filter(step => step.completed).length;
      const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { steps, ...pathData } = path; // Exclude full steps array from final list response if not needed
      return {
        ...pathData,
        totalSteps,
        completedSteps,
        progressPercentage,
      };
    });

    return NextResponse.json(pathsWithProgress);
  } catch (error) {
    console.error('Error fetching paths:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/paths - Create a new path
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title, description, color } = body;

    if (!userId || !title) {
      return NextResponse.json({ message: 'Missing required fields: userId, title' }, { status: 400 });
    }

    // Validate user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with ID ${userId} not found.` }, { status: 404 });
    }

    const newPath = await prisma.path.create({
      data: {
        userId,
        title,
        description,
        color, // Will use default from schema if not provided
      },
      include: {
        user: { select: { id: true, username: true } },
        steps: true, // Return with empty steps array
      },
    });

     // Augment with progress for consistency, though it will be 0 for new paths
    const pathWithProgress = {
        ...newPath,
        totalSteps: 0,
        completedSteps: 0,
        progressPercentage: 0,
    };


    return NextResponse.json(pathWithProgress, { status: 201 });
  } catch (error) {
    console.error('Error creating path:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: if there was a unique constraint on userId and title
      // if (error.code === 'P2002') {
      //   return NextResponse.json({ message: 'Path title already exists for this user.' }, { status: 409 });
      // }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
