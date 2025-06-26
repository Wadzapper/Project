'use client';

import { useEffect, useState } from 'react';
import { AchievementUnlockCriterionType, QuestType } from '@prisma/client'; // Assuming enums are available

// Types for Achievement data
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string | null;
  pointsAwarded: number;
  criteriaType: AchievementUnlockCriterionType;
  criteriaTargetSkillId?: string | null;
  criteriaTargetSkillLevel?: number | null;
  criteriaTargetQuestCount?: number | null;
  criteriaTargetQuestType?: QuestType | null;
  criteriaTargetSkillMasteryCount?: number | null;
  // criteriaTargetLoginStreakDays?: number | null; // Future
  createdAt: string;
}

export interface UserAchievementUnlock {
  id: string; // UserAchievement record ID
  achievementId: string;
  unlockedAt: string;
  progressDetails?: any | null;
  achievement: AchievementDefinition; // Nested full achievement detail
}


export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<AchievementDefinition[]>([]);
  const [userUnlocks, setUserUnlocks] = useState<UserAchievementUnlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setPageMessage(null);
      try {
        // const allAchievementsRes = await fetch('/api/achievements'); // API to be built
        // const userUnlocksRes = await fetch('/api/achievements/user'); // API to be built

        // if (!allAchievementsRes.ok) throw new Error('Failed to fetch all achievements');
        // if (!userUnlocksRes.ok) throw new Error("Failed to fetch user's achievements");

        // const allAchievementsData = await allAchievementsRes.json();
        // const userUnlocksData = await userUnlocksRes.json();

        // setAllAchievements(allAchievementsData);
        const allAchievementsRes = await fetch('/api/achievements');
        const userUnlocksRes = await fetch('/api/achievements/user');

        if (!allAchievementsRes.ok) {
            const errData = await allAchievementsRes.json();
            throw new Error(errData.error || 'Failed to fetch all achievements');
        }
        if (!userUnlocksRes.ok) {
            const errData = await userUnlocksRes.json();
            throw new Error(errData.error || "Failed to fetch user's achievements");
        }

        const allAchievementsData = await allAchievementsRes.json();
        const userUnlocksData = await userUnlocksRes.json();

        setAllAchievements(allAchievementsData);
        setUserUnlocks(userUnlocksData);

      } catch (error: any) {
        console.error(error);
        setPageMessage({ type: 'error', text: error.message || 'Could not load achievement data.' });
        setAllAchievements([]); // Clear data on error
        setUserUnlocks([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const isUnlocked = (achievementId: string) => {
    return userUnlocks.some(unlock => unlock.achievementId === achievementId);
  };

  const getUnlockDate = (achievementId: string): string | null => {
    const unlock = userUnlocks.find(u => u.achievementId === achievementId);
    return unlock ? new Date(unlock.unlockedAt).toLocaleDateString() : null;
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading achievements...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Achievements</h1>
        {/* Admin: Add New Achievement button could go here later */}
      </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}role="alert">
          {pageMessage.text}
        </div>
      )}

      {allAchievements.length === 0 && !isLoading ? (
         <div className="p-6 text-center bg-white rounded-lg shadow-md dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">No achievements defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {allAchievements.map((ach) => {
            const unlocked = isUnlocked(ach.id);
            const unlockedDate = getUnlockDate(ach.id);
            return (
              <div
                key={ach.id}
                className={`p-5 rounded-lg shadow-md flex flex-col items-center text-center transition-all duration-300
                            ${unlocked
                                ? 'bg-green-100 dark:bg-green-800 border-2 border-green-400 dark:border-green-600'
                                : 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 opacity-70'}`}
              >
                <div className={`text-4xl mb-3 ${unlocked ? 'filter-none' : 'filter grayscale'}`}>{ach.icon || '🏆'}</div>
                <h2 className={`text-lg font-semibold mb-1 ${unlocked ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {ach.name}
                </h2>
                <p className={`text-xs mb-2 ${unlocked ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {ach.description}
                </p>
                <p className={`text-xs font-bold ${unlocked ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {ach.pointsAwarded} points
                </p>
                {unlocked && unlockedDate && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Unlocked: {unlockedDate}
                  </p>
                )}
                {/* TODO: Progress bar for partial achievements if criteriaTargetQuestCount etc. */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
