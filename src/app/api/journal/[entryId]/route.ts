import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface JournalEntryUpdateInput {
  title?: string;
  content?: string;
  date?: string; // ISO string
  tags?: string[];
  linkedSkillIds?: string[];
  linkedQuestIds?: string[];
  linkedAchievementIds?: string[];
}

function validateJournalEntryUpdateInput(data: any): { isValid: boolean; errors?: any; data?: JournalEntryUpdateInput } {
  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
    return { isValid: false, errors: { title: 'Title cannot be empty if provided.' } };
  }
  if (data.content !== undefined && (typeof data.content !== 'string' || data.content.trim().length === 0)) {
    return { isValid: false, errors: { content: 'Content cannot be empty if provided.' } };
  }
  if (data.date !== undefined && isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Invalid date format.' } };
  }
   if (data.tags !== undefined && !Array.isArray(data.tags)) {
    return { isValid: false, errors: { tags: 'Tags must be an array of strings.'}};
  }
  // Add validation for linked IDs if needed
  return { isValid: true, data: data as JournalEntryUpdateInput };
}


// GET /api/journal/[entryId] - Get a single journal entry by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { entryId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { entryId } = params;

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId, userId: session.user.id },
    });
    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (error) {
    console.error(`Error fetching journal entry ${entryId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch journal entry' }, { status: 500 });
  }
}

// PATCH /api/journal/[entryId] - Update a journal entry by ID
export async function PATCH(
  req: NextRequest,
  { params }: { params: { entryId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { entryId } = params;

  let body: JournalEntryUpdateInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateJournalEntryUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  const updateData = { ...validation.data };
  if (updateData.date) {
    (updateData as any).date = new Date(updateData.date); // Convert date string to Date object
  }


  try {
    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id: entryId, userId: session.user.id },
    });
    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found or access denied' }, { status: 404 });
    }

    const updatedEntry = await prisma.journalEntry.update({
      where: { id: entryId },
      data: updateData,
    });
    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error(`Error updating journal entry ${entryId}:`, error);
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
  }
}

// DELETE /api/journal/[entryId] - Delete a journal entry by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { entryId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { entryId } = params;

  try {
    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id: entryId, userId: session.user.id },
    });
    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found or access denied' }, { status: 404 });
    }

    await prisma.journalEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ message: 'Journal entry deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting journal entry ${entryId}:`, error);
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
  }
}
