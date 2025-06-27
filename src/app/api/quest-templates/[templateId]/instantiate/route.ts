// Summary: API route to instantiate a Quest from a QuestTemplate.
// TODO: More sophisticated QuestDependency creation based on template's linkedSkillIds if needed.
//       For example, if template skills imply specific target levels or XP amounts.
//       Current MVP creates basic 'SKILL_PRESENT' type dependencies if skill linking is simple.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestDependencyType, QuestType } from '@prisma/client'; // Assuming QuestDependencyType.SKILL_PRESENT or similar

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { templateId } = params;

  try {
    const template = await prisma.questTemplate.findUnique({
      where: { id: templateId, userId: userId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Quest template not found, is archived, or access denied' }, { status: 404 });
    }
    if (template.isArchived) {
        return NextResponse.json({ error: 'Cannot instantiate an archived quest template.'}, { status: 400 });
    }

    // Create new Quest based on template data
    const newQuest = await prisma.quest.create({
      data: {
        userId,
        title: template.title, // Can add "(from template)" or similar if desired
        description: template.description,
        type: template.type,
        xpReward: template.xpReward,
        status: QuestStatus.PENDING, // Default status for new quests
        // parentQuestId, chainName, orderInChain would be set if those features are active
      },
    });

    // Create QuestDependencies if template.linkedSkillIds has entries
    // This is a simplified dependency creation. Assumes a basic dependency type like 'SKILL_PRESENT' or similar.
    // A more robust system might involve template fields for target levels, XP, etc., for each linked skill.
    if (template.linkedSkillIds && template.linkedSkillIds.length > 0) {
      const dependencyCreates = template.linkedSkillIds.map(skillId => ({
        questId: newQuest.id,
        type: QuestDependencyType.SKILL_TARGET_LEVEL, // Defaulting to this type for MVP.
                                                       // This implies the skill needs to reach a certain level.
                                                       // The template doesn't store targetLevel, so this dependency
                                                       // would need manual configuration on the quest later, or template enhancement.
                                                       // For a true "skill used in quest" maybe a simpler type or no target.
        skillId: skillId,
        // targetLevel: 1, // Placeholder, as template doesn't store this.
        // targetXp: null,
        // itemIdentifier: null,
        description: `Requires skill (ID: ${skillId})`, // Auto-generated description
      }));

      if (dependencyCreates.length > 0) {
        await prisma.questDependency.createMany({
          data: dependencyCreates,
        });
      }
    }

    // Fetch the quest with its dependencies to return
    const newQuestWithDetails = await prisma.quest.findUnique({
        where: {id: newQuest.id},
        include: {dependencies: true}
    })

    return NextResponse.json(newQuestWithDetails, { status: 201 });

  } catch (error) {
    console.error(`Error instantiating quest from template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to instantiate quest from template' }, { status: 500 });
  }
}
