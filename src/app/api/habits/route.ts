// src/app/api/habits/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, HabitFrequency } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/habits - Fetch all habits for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const archived = searchParams.get('archived'); // 'true', 'false', or undefined for all

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId' }, { status: 400 });
  }

  try {
    const whereClause: Prisma.HabitWhereInput = { userId };
    if (archived === 'true') {
      whereClause.archived = true;
    } else if (archived === 'false') {
      whereClause.archived = false;
    }

    const habits = await prisma.habit.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true } },
        history: { // Include recent history for quick overview
          orderBy: { date: 'desc' },
          take: 7, // e.g., last 7 entries
        },
        _count: {
          select: { history: true }
        }
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(habits);
  } catch (error) {
    console.error('Error fetching habits:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/habits - Create a new habit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId, name, description, frequency, target, color, reminderTime, positive
    } = body;

    if (!userId || !name || !frequency) {
      return NextResponse.json({ message: 'Missing required fields: userId, name, frequency' }, { status: 400 });
    }

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });
    }

    if (!Object.values(HabitFrequency).includes(frequency as HabitFrequency)) {
        return NextResponse.json({ message: `Invalid habit frequency: ${frequency}` }, { status: 400 });
    }

    const newHabit = await prisma.habit.create({
      data: {
        user: { connect: { id: userId } },
        name,
        description,
        frequency: frequency as HabitFrequency,
        target,
        color,
        reminderTime,
        positive,
        streak: 0,
        longestStreak: 0,
      },
      include: {
        user: { select: { id: true, username: true } },
      }
    });
    return NextResponse.json(newHabit, { status: 201 });
  } catch (error) {
    console.error('Error creating habit:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
