// Summary: API endpoint for Tag Analytics.
// Returns a list of user's tags with counts of associated habits and quests.
// NOTE: The current Prisma schema stores tags as string arrays on Habit and JournalEntry models.
// There is no separate Tag model. This route needs to be updated to reflect that schema.
// For now, to fix the build, it will return an empty array.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface TagAnalyticsData {
  id: string; // Tag name will be used as ID for now
  name: string;
  color: string | null; // Color is not available with current schema for string tags
  habitCount: number;
  questCount: number; // Quests also don't have tags in current schema
  journalEntryCount: number;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Since there's no Tag model, we need to aggregate tags from models that use them.
    // For now, returning an empty array to ensure the build passes.
    // Actual implementation will require fetching Habits, JournalEntries, etc.,
    // and then processing their `tags: String[]` fields.

    const habits = await prisma.habit.findMany({
        where: { userId },
        select: { tags: true }
    });

    const journalEntries = await prisma.journalEntry.findMany({
        where: { userId },
        select: { tags: true }
    });

    const tagMap = new Map<string, { name: string, habitCount: number, questCount: number, journalEntryCount: number }>();

    habits.forEach(habit => {
        habit.tags.forEach(tagName => {
            const tag = tagMap.get(tagName) || { name: tagName, habitCount: 0, questCount: 0, journalEntryCount: 0 };
            tag.habitCount++;
            tagMap.set(tagName, tag);
        });
    });

    journalEntries.forEach(entry => {
        entry.tags.forEach(tagName => {
            const tag = tagMap.get(tagName) || { name: tagName, habitCount: 0, questCount: 0, journalEntryCount: 0 };
            tag.journalEntryCount++;
            tagMap.set(tagName, tag);
        });
    });

    // Note: Quests do not have a tags field in the current schema. QuestCount will be 0.

    const analyticsData: TagAnalyticsData[] = Array.from(tagMap.values()).map(tag => ({
        id: tag.name, // Using name as ID since there's no separate Tag model
        name: tag.name,
        color: null, // Color information isn't stored with string tags
        habitCount: tag.habitCount,
        questCount: tag.questCount,
        journalEntryCount: tag.journalEntryCount,
    })).sort((a, b) => a.name.localeCompare(b.name));


    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Error processing tag analytics:', error);
    return NextResponse.json({ error: 'Failed to process tag analytics' }, { status: 500 });
  }
}
