// Summary: API endpoint to fetch all quests belonging to the same chain as a given questId.
// It traverses up to find the root and then collects all descendants.
// TODO: Consider adding an 'orderInChain' field to Quest model for explicit ordering if createdAt is not sufficient.
// TODO: Add pagination or limits if chains can become excessively long.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Quest, QuestStatus, QuestType } from '@prisma/client';

// Type for the quests returned in the chain
type ChainedQuestInfo = Pick<Quest, 'id' | 'title' | 'status' | 'type' | 'parentQuestId' | 'createdAt'>;

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
    // 1. Find the current quest to verify ownership and start traversal
    let currentQuest = await prisma.quest.findUnique({
      where: { id: currentQuestId, userId: userId },
    });

    if (!currentQuest) {
      return NextResponse.json({ error: 'Quest not found or access denied.' }, { status: 404 });
    }

    // 2. Traverse upwards to find the root of the chain
    let rootQuest = currentQuest;
    const visitedParentIds = new Set<string>(); // To detect cycles, though parentQuestId should prevent deep cycles
    while (rootQuest.parentQuestId && !visitedParentIds.has(rootQuest.parentQuestId)) {
      visitedParentIds.add(rootQuest.id); // Add current id before moving up
      const parent = await prisma.quest.findUnique({
        where: { id: rootQuest.parentQuestId, userId: userId }, // Ensure parent also belongs to user
      });
      if (parent) {
        rootQuest = parent;
      } else {
        // Parent not found or not owned, means current rootQuest is the effective root for this user's chain segment
        break;
      }
       if (rootQuest.id === rootQuest.parentQuestId) break; // Self-parented is a root
    }

    // 3. Collect all quests in the chain starting from the root
    // This involves fetching all quests that have this rootQuest.id as an ancestor,
    // or all quests that share a common (hypothetical) chainId.
    // For a simple parentQuestId structure, we can fetch the root and all its direct/indirect children.

    const chainQuests: ChainedQuestInfo[] = [];
    const queue: Quest[] = [rootQuest];
    const processedIds = new Set<string>(); // To avoid processing quests multiple times if graph is not strictly a tree

    while (queue.length > 0) {
      const questToProcess = queue.shift()!; // Non-null assertion as queue.length > 0

      if (processedIds.has(questToProcess.id)) {
          continue;
      }
      processedIds.add(questToProcess.id);

      chainQuests.push({
        id: questToProcess.id,
        title: questToProcess.title,
        status: questToProcess.status,
        type: questToProcess.type,
        parentQuestId: questToProcess.parentQuestId,
        createdAt: questToProcess.createdAt,
      });

      const children = await prisma.quest.findMany({
        where: { parentQuestId: questToProcess.id, userId: userId },
        orderBy: { createdAt: 'asc' }, // Default order for children
      });
      queue.push(...children);
    }

    // Sort the final chain. A common way is by parent linkage then creation time.
    // For a simple linear chain, sorting by createdAt after finding all members might be enough
    // if parentQuestId always refers to an older quest.
    // If there's an explicit orderInChain field, that would be best.
    // For now, let's sort by createdAt as a baseline.
    chainQuests.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());


    if (chainQuests.length === 0 && currentQuest) {
        // If after all processing, the chain is empty but we had a valid currentQuest,
        // it means it's a standalone quest. Return it as a chain of one.
         chainQuests.push({
            id: currentQuest.id, title: currentQuest.title, status: currentQuest.status,
            type: currentQuest.type, parentQuestId: currentQuest.parentQuestId, createdAt: currentQuest.createdAt
        });
    }


    return NextResponse.json(chainQuests);

  } catch (error) {
    console.error(`Error fetching quest chain for quest ${currentQuestId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest chain' }, { status: 500 });
  }
}
