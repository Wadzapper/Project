import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const questTypeCounts = await prisma.quest.groupBy({
      by: ['type'],
      where: {
        userId,
        status: QuestStatus.COMPLETED, // Only count completed quests for type distribution
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    const formattedData = questTypeCounts.map(group => ({
      name: group.type.toString().replace('_', ' '), // Format for display
      value: group._count.id,
    }));

    // Ensure all QuestTypes are present, even if count is 0
    const allQuestTypes = Object.values(QuestType);
    for (const type of allQuestTypes) {
        if (!formattedData.find(d => d.name === type.toString().replace('_', ' '))) {
            formattedData.push({ name: type.toString().replace('_', ' '), value: 0});
        }
    }


    return NextResponse.json(formattedData);

  } catch (error) {
    console.error('Error fetching quest type distribution:', error);
    return NextResponse.json({ error: 'Failed to fetch quest type distribution' }, { status: 500 });
  }
}
