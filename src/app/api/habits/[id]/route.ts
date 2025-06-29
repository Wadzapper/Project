// src/app/api/habits/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, HabitFrequency } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string; // Habit ID
  };
}

// GET /api/habits/[id] - Fetch a single habit by ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const habit = await prisma.habit.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        history: { // Include all history for a detailed view
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!habit) {
      return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
    }
    return NextResponse.json(habit);
  } catch (error) {
    console.error(`Error fetching habit ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/habits/[id] - Update a habit by ID
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name, description, frequency, target, streak, longestStreak,
      lastCompletedDate, archived, color, reminderTime, positive
    } = body;

    const updateData: Prisma.HabitUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (frequency !== undefined) {
      if (!Object.values(HabitFrequency).includes(frequency as HabitFrequency)) {
        return NextResponse.json({ message: `Invalid habit frequency: ${frequency}` }, { status: 400 });
      }
      updateData.frequency = frequency as HabitFrequency;
    }
    if (target !== undefined) updateData.target = target; // Can be null
    if (streak !== undefined) updateData.streak = streak;
    if (longestStreak !== undefined) updateData.longestStreak = longestStreak;
    if (lastCompletedDate !== undefined) updateData.lastCompletedDate = lastCompletedDate ? new Date(lastCompletedDate) : null;
    if (archived !== undefined) updateData.archived = archived;
    if (color !== undefined) updateData.color = color;
    if (reminderTime !== undefined) updateData.reminderTime = reminderTime;
    if (positive !== undefined) updateData.positive = positive;

    const updatedHabit = await prisma.habit.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        history: { orderBy: { date: 'desc' }, take: 7 }, // Include some recent history
      },
    });

    return NextResponse.json(updatedHabit);
  } catch (error) {
    console.error(`Error updating habit ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/habits/[id] - Delete a habit by ID
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    // Deleting a habit will also cascade delete its HabitHistory entries
    // due to the relation `history HabitHistory[]` in the Habit model
    // and `habit Habit @relation(fields: [habitId], references: [id], onDelete: Cascade)` in HabitHistory.
    await prisma.habit.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Habit and its history deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting habit ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
