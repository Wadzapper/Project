import {
    PrismaClient,
    User,
    Skill,
    Quest,
    Achievement,
    UserAchievement,
    AchievementUnlockCriterionType,
    QuestStatus,
    QuestType
} from '@prisma/client';

// Define a type for Prisma Transaction Client if not already globally available
type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface EventData {
    skill?: Skill;
    quest?: Quest & { dependencies?: QuestDependency[] }; // Quest with dependencies
    // other potential event data sources
}

/**
 * Checks relevant achievements and unlocks them for the user if criteria are met.
 * This function should be called within a Prisma transaction along with the originating action (skill update, quest completion).
 * @param tx Prisma Transaction Client
 * @param userId The ID of the user for whom to check achievements.
 * @param eventType A string identifying the type of event that occurred (e.g., "SKILL_UPDATED", "QUEST_COMPLETED").
 * @param eventData Data related to the event (e.g., the updated skill object, the completed quest object).
 */
export async function checkAndUnlockAchievements(
    tx: PrismaTransactionClient,
    userId: string,
    eventType: "SKILL_UPDATED" | "QUEST_COMPLETED" | "USER_ACTION", // USER_ACTION for generic checks like login streak
    eventData: EventData
): Promise<UserAchievement[]> {
    const unlockedAchievements: UserAchievement[] = [];

    // 1. Fetch all global achievement definitions that the user hasn't unlocked yet.
    const userExistingUnlockIds = (await tx.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true }
    })).map(ua => ua.achievementId);

    const potentialAchievements = await tx.achievement.findMany({
        where: {
            id: { notIn: userExistingUnlockIds.length > 0 ? userExistingUnlockIds : undefined } // Handle empty array for notIn
        }
    });

    if (potentialAchievements.length === 0) return [];

    // 2. For each potential achievement, check its criteria.
    for (const achievement of potentialAchievements) {
        let criteriaMet = false;
        switch (achievement.criteriaType) {
            case AchievementUnlockCriterionType.SKILL_LEVEL_REACHED:
                if (eventType === "SKILL_UPDATED" && eventData.skill &&
                    (achievement.criteriaTargetSkillId === null || eventData.skill.id === achievement.criteriaTargetSkillId) && // Specific or any skill
                    eventData.skill.currentLevel >= (achievement.criteriaTargetSkillLevel || 0)
                ) {
                    criteriaMet = true;
                }
                break;

            case AchievementUnlockCriterionType.QUESTS_COMPLETED_TOTAL:
                if (eventType === "QUEST_COMPLETED") { // Check when any quest is completed
                    const completedQuestsCount = await tx.quest.count({
                        where: { userId, status: QuestStatus.COMPLETED }
                    });
                    if (completedQuestsCount >= (achievement.criteriaTargetQuestCount || 0)) {
                        criteriaMet = true;
                    }
                }
                break;

            case AchievementUnlockCriterionType.QUESTS_OF_TYPE_COMPLETED:
                 if (eventType === "QUEST_COMPLETED" && eventData.quest && achievement.criteriaTargetQuestType) {
                    if (eventData.quest.type === achievement.criteriaTargetQuestType) { // Check if the completed quest is of the target type
                        const completedQuestsOfTypeCount = await tx.quest.count({
                            where: {
                                userId,
                                status: QuestStatus.COMPLETED,
                                type: achievement.criteriaTargetQuestType
                            }
                        });
                        if (completedQuestsOfTypeCount >= (achievement.criteriaTargetQuestCount || 0)) {
                            criteriaMet = true;
                        }
                    }
                }
                break;

            case AchievementUnlockCriterionType.SKILLS_MASTERED_COUNT:
                // "Mastery" could be a specific level, e.g., 10, or max level if skills have one.
                // Assuming mastery is reaching level 10 for this example.
                const masteryLevel = 10; // Define mastery level
                if (eventType === "SKILL_UPDATED") { // Check when any skill is updated
                    const masteredSkillsCount = await tx.skill.count({
                        where: { userId, currentLevel: { gte: masteryLevel } }
                    });
                    if (masteredSkillsCount >= (achievement.criteriaTargetSkillMasteryCount || 0)) {
                        criteriaMet = true;
                    }
                }
                break;

            // case AchievementUnlockCriterionType.LOGIN_STREAK_DAYS: (Future)
            //     // This would likely be triggered by a "USER_ACTION" eventType='USER_LOGIN'
            //     // and require a separate table to track daily logins / streaks.
            //     break;

            default:
                break;
        }

        if (criteriaMet) {
            const newUnlock = await tx.userAchievement.create({
                data: {
                    userId,
                    achievementId: achievement.id,
                    // progressDetails could be set here if it's a multi-step achievement partially completed
                },
                include: { achievement: true } // Include full achievement for return
            });
            unlockedAchievements.push(newUnlock);

            // Optional: Award points/XP directly to user or log it
            if (achievement.pointsAwarded > 0) {
                // Example: Update user's global XP or points (if User model has such fields)
                // await tx.user.update({ where: { id: userId }, data: { totalScore: { increment: achievement.pointsAwarded } } });
                // Or, create a log entry for points/XP awarded by achievement
            }
        }
    }

    return unlockedAchievements;
}
