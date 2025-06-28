// Summary: API endpoint to fetch details for a given quest, intended to later support chains.
// NOTE: The current Prisma schema for Quest does not have a direct parentQuestId field.
// True chain traversal would require using QuestDependency relations.
// For now, this route will return information about the specified quest only.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Quest, QuestStatus, QuestType } from '@prisma/client';

// Type for the quest info returned
type QuestChainResponseItem = Pick<Quest, 'id' | 'name' | 'status' | 'type' | 'description' | 'createdAt' | 'completedAt' | 'failedAt'>;

export async function GET(
  req: NextRequest,
  { params }: { params: { questId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { questId: currentQuestId } = params;

  if (!currentQuestId) {
    return NextResponse.json({ error: 'Quest ID is required.' }, { status: 400 });
  }

  try {
    const quest = await prisma.quest.findUnique({
      where: { id: currentQuestId, userId: userId },
      // Select fields that exist on the Quest model
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        description: true,
        createdAt: true,
        completedAt: true,
        failedAt: true,
        // parentQuestId does not exist, so it's removed.
        // Dependencies would be fetched if needed for chain logic, but that's more complex.
      }
    });

    if (!quest) {
      return NextResponse.json({ error: 'Quest not found or access denied.' }, { status: 404 });
    }

    // For now, the "chain" is just the quest itself.
    // Full chain logic based on QuestDependency would be a future enhancement.
    const responseData: QuestChainResponseItem[] = [quest];

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`Error fetching quest (for chain display) ${currentQuestId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest data' }, { status: 500 });
  }
}
