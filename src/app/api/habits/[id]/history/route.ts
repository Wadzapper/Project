// src/app/api/habits/[id]/history/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string; // Habit ID
  };
}

// GET /api/habits/[id]/history - Fetch all history for a specific habit
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id: habitId } = params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset') as string, 10) : undefined;


    const habitExists = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habitExists) {
      return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
    }

    const historyEntries = await prisma.habitHistory.findMany({
      where: { habitId },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });

    const totalCount = await prisma.habitHistory.count({ where: { habitId }});

    return NextResponse.json({
      data: historyEntries,
      totalCount,
      page: offset && limit ? Math.floor(offset / limit) + 1 : 1,
      limit
    });
  } catch (error) {
    console.error(`Error fetching history for habit ${params.id}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}


// POST /api/habits/[id]/history - Log a new history entry (completion/miss)
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: habitId } = params;
    const body = await request.json();
    const { date, completed, notes } = body; // date should be YYYY-MM-DD string or ISO string

    if (date === undefined || completed === undefined) {
      return NextResponse.json({ message: 'Missing required fields: date, completed' }, { status: 400 });
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit) {
      return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
    }

    // Ensure date is handled correctly (e.g., start of day UTC to avoid timezone issues for daily habits)
    const entryDate = new Date(date);
    entryDate.setUTCHours(0,0,0,0);


    // Upsert: create new or update if entry for that date already exists
    const historyEntry = await prisma.habitHistory.upsert({
      where: {
        habitId_date: { // Unique constraint on habitId and date
          habitId: habitId,
          date: entryDate,
        }
      },
      update: {
        completed,
        notes,
      },
      create: {
        habitId,
        date: entryDate,
        completed,
        notes,
      },
    });

    // TODO: After logging history, update habit's streak and lastCompletedDate.
    // This logic can be complex and might be better suited for a service layer or transaction.
    // For now, we'll keep it simple. Streak update would require fetching all recent history.

    return NextResponse.json(historyEntry, { status: 201 });
  } catch (error) {
    console.error(`Error logging history for habit ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003' && error.meta?.field_name === 'HabitHistory_habitId_fkey (index)') {
         return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/habits/[id]/history/[historyEntryId] - This would be for specific entry deletion
// For now, not implementing specific history entry deletion, but it would be a DELETE method on a
// nested route like /api/habits/[id]/history/[historyEntryId]/route.ts
// Or, could be a PATCH/PUT to this route with a list of entries to delete/modify.
// For simplicity, bulk history changes are not handled here.
// To delete a specific entry, one could pass its ID in the body of a DELETE request to this route.
export async function DELETE(request: Request, { params }: RouteContext) {
    try {
        const { id: habitId } = params;
        const { searchParams } = new URL(request.url);
        const historyEntryId = searchParams.get('historyEntryId'); // Expecting history entry ID as query param

        if (!historyEntryId) {
            return NextResponse.json({ message: 'Missing historyEntryId query parameter' }, { status: 400 });
        }

        const habit = await prisma.habit.findUnique({ where: { id: habitId } });
        if (!habit) {
            return NextResponse.json({ message: 'Habit not found' }, { status: 404 });
        }

        await prisma.habitHistory.delete({
            where: { id: historyEntryId, habitId: habitId }, // Ensure it's deleting from the correct habit
        });

        // TODO: Recalculate streak after deletion
        return NextResponse.json({ message: 'Habit history entry deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error(`Error deleting history entry for habit ${params.id}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') { // Record to delete not found
                return NextResponse.json({ message: 'Habit history entry not found or does not belong to this habit' }, { status: 404 });
            }
            return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
