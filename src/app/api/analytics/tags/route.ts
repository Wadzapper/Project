// Summary: API endpoint for Tag Analytics.
// Returns a list of user's tags with counts of associated habits and quests.
// Assumes Tag model and M-M relations (HabitTag, QuestTag) are defined in Prisma schema.
// TODO: Add filtering for habits/quests (e.g., only count non-archived items).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface TagAnalyticsData {
  id: string;
  name: string;
  color: string | null;
  habitCount: number;
  questCount: number;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const userTags = await prisma.tag.findMany({
      where: { userId: userId },
      include: {
        _count: {
          select: {
            habits: true, // Counts records in HabitTag linking to this tag
            quests: true, // Counts records in QuestTag linking to this tag
          },
        },
      },
      orderBy: {
        name: 'asc', // Or by usage count, etc.
      },
    });

    const analyticsData: TagAnalyticsData[] = userTags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color || null,
      habitCount: tag._count.habits,
      questCount: tag._count.quests,
    }));

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Error fetching tag analytics:', error);
    // Check if error is due to missing Tag table (e.g. PrismaClientKnownRequestError P2021)
    // This might happen if schema changes weren't actually applied.
    if ((error as any)?.code === 'P2021' || (error as any)?.message?.includes("Table `main.Tag` doesn't exist")) {
         return NextResponse.json({
            error: 'Tag feature might not be fully set up in the database schema.',
            details: "Required tables (Tag, HabitTag, QuestTag) may be missing."
        }, { status: 501 }); // Not Implemented / Misconfigured
    }
    return NextResponse.json({ error: 'Failed to fetch tag analytics' }, { status: 500 });
  }
}
