import {
    Quest,
    QuestDependency,
    Skill,
    QuestDependencyType,
    // QuestLog, // Not used directly in these functions for now, but could be for streaks
    QuestStatus
} from '@prisma/client';

// Extended types for function arguments, assuming skill data is pre-fetched if needed
export type QuestDependencyWithSkill = QuestDependency & { skill?: Skill | null };
export type QuestWithDetails = Quest & {
    dependencies: QuestDependencyWithSkill[];
    // user?: User; // if needed for user-specific context not covered by skill.userId
};

/**
 * Checks if a single quest dependency is met.
 * @param dependency The quest dependency object.
 * @param relevantSkill (Optional) The current state of the skill relevant to this dependency.
 * @returns boolean True if the dependency is met, false otherwise.
 */
export function checkSingleDependencyCompletion(
    dependency: QuestDependencyWithSkill,
    relevantSkill?: Skill | null
): boolean {
    if (dependency.isCompleted) return true; // Already marked as complete

    switch (dependency.type) {
        case QuestDependencyType.MANUAL_CHECK:
            // This type is usually updated directly by user interaction,
            // but if it has other conditions (e.g. description must be non-empty), check here.
            // For now, if not pre-marked complete, it's not met by this function.
            return false;

        case QuestDependencyType.SKILL_LEVEL_REACHED:
            if (!dependency.skillId || !relevantSkill || dependency.targetSkillLevel === null || dependency.targetSkillLevel === undefined) return false;
            return relevantSkill.currentLevel >= dependency.targetSkillLevel;

        case QuestDependencyType.SKILL_XP_GAINED_TOTAL:
            if (!dependency.skillId || !relevantSkill || dependency.targetSkillXp === null || dependency.targetSkillXp === undefined) return false;
            return relevantSkill.currentXp >= dependency.targetSkillXp;

        case QuestDependencyType.SKILL_XP_GAINED_RELATIVE:
            // This requires tracking XP gained *since the quest started* or since this dependency was added.
            // This logic needs `currentProgress` on the dependency to be updated elsewhere.
            // For now, assume `currentProgress` holds the relative XP gained.
            // Also check if the skill itself still exists for this dependency type.
            if (!dependency.skillId || !relevantSkill || dependency.currentProgress === null || dependency.currentProgress === undefined ||
                dependency.targetSkillXp === null || dependency.targetSkillXp === undefined) return false;
            return dependency.currentProgress >= dependency.targetSkillXp;

        case QuestDependencyType.COMPLETE_BY_DATE:
            if (!dependency.targetDate) return false;
            // If a quest with a COMPLETE_BY_DATE dependency is not yet COMPLETED,
            // and the current date is past the targetDate, the dependency (and quest) might be considered FAILED.
            // This function just checks if it *could* be complete if other conditions met.
            // The actual "failing" due to date passing would be handled by a separate process or when quest status is evaluated.
            // For now, this dependency type is met if the date hasn't passed OR if it's manually completed.
            // A simpler check for "is it possible to complete now?"
            return new Date() <= new Date(dependency.targetDate);
            // A more accurate check would happen when attempting to complete the quest:
            // if (quest.status === QuestStatus.COMPLETED) return new Date(quest.completedAt) <= new Date(dependency.targetDate);

        // case QuestDependencyType.QUEST_COMPLETED_STREAK: (Future)
        //     // Requires access to QuestLog or similar history for the target quest.
        //     return false;

        default:
            return false;
    }
}


/**
 * Evaluates a quest's overall completion status based on its dependencies.
 * Updates the isCompleted status of individual dependencies.
 * @param quest The quest object with its dependencies (and relevant skill data pre-fetched for dependencies).
 * @param userSkills A map or array of all user's skills to look up relevant skill data.
 * @returns Object containing:
 *  - `allDependenciesMet`: boolean, true if all dependencies are now met.
 *  - `updatedDependencies`: QuestDependency[], array of dependencies with their `isCompleted` status potentially updated.
 *  - `newQuestStatus`: QuestStatus, the suggested new status for the quest.
 */
export function evaluateQuestCompletion(
    quest: QuestWithDetails,
    userSkills: Map<string, Skill> // Map skillId to Skill object for quick lookup
): { allDependenciesMet: boolean; updatedDependencies: QuestDependency[]; newQuestStatus: QuestStatus } {

    if (quest.status === QuestStatus.COMPLETED || quest.status === QuestStatus.FAILED || quest.status === QuestStatus.CANCELLED) {
        // If already in a terminal state, no re-evaluation needed by this function
        // (unless a "re-open" feature exists, which is out of scope here)
        return {
            allDependenciesMet: quest.status === QuestStatus.COMPLETED,
            updatedDependencies: quest.dependencies,
            newQuestStatus: quest.status
        };
    }

    let allMet = true;
    const updatedDeps = quest.dependencies.map(dep => {
        let relevantSkill: Skill | undefined | null = null;
        if (dep.skillId) {
            relevantSkill = userSkills.get(dep.skillId);
        }

        const isNowMet = checkSingleDependencyCompletion(dep, relevantSkill);
        if (!isNowMet) {
            allMet = false;
        }
        return { ...dep, isCompleted: isNowMet };
    });

    let newStatus = quest.status;
    if (allMet) {
        newStatus = QuestStatus.COMPLETED;
    } else {
        // Check for failure conditions, e.g., overdue DATE_TARGET
        const overdueDependency = updatedDeps.find(
            dep => dep.type === QuestDependencyType.COMPLETE_BY_DATE &&
                   dep.targetDate &&
                   new Date() > new Date(dep.targetDate) &&
                   !dep.isCompleted // And it wasn't met in time
        );
        if (overdueDependency) {
            newStatus = QuestStatus.FAILED;
        } else if (updatedDeps.some(d => d.isCompleted) && quest.status === QuestStatus.PENDING) {
            // If any dependency is met and quest was PENDING, move to IN_PROGRESS
            newStatus = QuestStatus.IN_PROGRESS;
        }
        // If no dependencies met and it was PENDING, it remains PENDING unless a failure condition is met.
    }

    return {
        allDependenciesMet: allMet,
        updatedDependencies: updatedDeps,
        newQuestStatus: newStatus,
    };
}
