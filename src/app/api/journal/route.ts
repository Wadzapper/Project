import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface JournalEntryInput {
  title: string;
  content: string;
  date?: string; // ISO string
  tags?: string[];
  linkedSkillIds?: string[];
  linkedQuestIds?: string[];
  linkedAchievementIds?: string[];
}

function validateJournalEntryInput(data: any): { isValid: boolean; errors?: any; data?: JournalEntryInput } {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    return { isValid: false, errors: { title: 'Title is required.' } };
  }
  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    return { isValid: false, errors: { content: 'Content is required.' } };
  }
  if (data.date && isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Invalid date format.' } };
  }
  if (data.tags && !Array.isArray(data.tags)) {
    return { isValid: false, errors: { tags: 'Tags must be an array of strings.'}};
  }
  // Add validation for linked IDs if needed (e.g., check if they are valid CUIDs or exist)
  return { isValid: true, data: data as JournalEntryInput };
}

// GET /api/journal - Get all journal entries for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const tagsParam = searchParams.get('tags'); // Comma-separated string of tags

  const whereClause: any = { userId: session.user.id };

  if (startDateParam) {
    whereClause.date = { ...whereClause.date, gte: new Date(startDateParam) };
  }
  if (endDateParam) {
    // Add 1 day to endDate to make it inclusive of the end date
    const endDate = new Date(endDateParam);
    endDate.setDate(endDate.getDate() + 1);
    whereClause.date = { ...whereClause.date, lt: endDate };
  }
  if (tagsParam) {
    const tagsArray = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tagsArray.length > 0) {
      whereClause.tags = { hasSome: tagsArray };
    }
  }

  try {
    const journalEntries = await prisma.journalEntry.findMany({
      where: whereClause,
      orderBy: { date: 'desc' }, // Default sort: newest first by entry date
    });
    return NextResponse.json(journalEntries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

// POST /api/journal - Create a new journal entry
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: JournalEntryInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateJournalEntryInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const {
    title, content, date, tags,
    linkedSkillIds, linkedQuestIds, linkedAchievementIds
  } = validation.data;

  try {
    const newEntry = await prisma.journalEntry.create({
      data: {
        userId: session.user.id,
        title,
        content,
        date: date ? new Date(date) : new Date(), // Default to now if not provided
        tags: tags || [],
        linkedSkillIds: linkedSkillIds || [],
        linkedQuestIds: linkedQuestIds || [],
        linkedAchievementIds: linkedAchievementIds || [],
      },
    });
    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
