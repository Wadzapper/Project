// Summary: API routes for listing all unique tags and creating new ones (if a Tag model existed).
// NOTE: Tag model does not exist. GET will aggregate from existing string arrays. POST is not applicable.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db'; // Prisma is needed for reading habits/journal entries

interface TagResponseItem {
    id: string; // For consistency, using the tag name as ID
    name: string;
    color: string | null; // Color is not available with current schema for string tags
    // Counts can be added if needed, similar to analytics route, but for now just list unique tags
}

// GET /api/tags - Get all unique tags used by the user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const habits = await prisma.habit.findMany({
        where: { userId },
        select: { tags: true }
    });

    const journalEntries = await prisma.journalEntry.findMany({
        where: { userId },
        select: { tags: true }
    });

    const allTagStrings = new Set<string>();
    habits.forEach(h => h.tags.forEach(tag => allTagStrings.add(tag)));
    journalEntries.forEach(j => j.tags.forEach(tag => allTagStrings.add(tag)));

    const uniqueTags: TagResponseItem[] = Array.from(allTagStrings).map(tagName => ({
        id: tagName, // Using the tag name itself as an ID
        name: tagName,
        color: null, // Color information is not stored with simple string tags
    })).sort((a,b) => a.name.localeCompare(b.name));

    return NextResponse.json(uniqueTags);

  } catch (error) {
    console.error('Error fetching unique tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST /api/tags - Create a new tag (Not applicable with current schema)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Feature Not Implemented: Tags are created implicitly by adding them to items. No separate Tag model exists.' },
    { status: 501 }
  );
}
