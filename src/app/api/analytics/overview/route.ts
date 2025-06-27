import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
// Removed QuestType, QuestStatus, RatingCategory, subDays, startOfDay, endOfDay as they are now handled in analyticsUtils
import {
    calculateQuestCompletionStatsForUser,
    getRecentFitnessActivity,
    getAverageMood
} from '@/lib/analyticsUtils'; // Import shared utilities
import { RatingCategory } from '@prisma/client'; // Still need this if not passed to util

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // 1. Skill XP Totals
    const skillAggregate = await prisma.skill.aggregate({
      _sum: { currentXp: true },
      _count: { id: true },
      where: { userId: userId },
    });
    const totalSkillXp = skillAggregate._sum.currentXp || 0;
    const totalSkills = skillAggregate._count.id || 0;

    // 2. Quest Completion Stats - Use shared utility
    const questStats = await calculateQuestCompletionStatsForUser(userId);

    // 3. Fitness Trends - Use shared utility (default 7 days)
    const fitnessActivity = await getRecentFitnessActivity(userId);

    // 4. Mood Scores - Use shared utility (default 7 days)
    const moodData = await getAverageMood(userId);


    const overviewData = {
      skills: {
        totalXp: totalSkillXp,
        count: totalSkills,
      },
      quests: questStats, // Contains .byType and .overall
      fitness: {
        totalDurationLastNDaysMinutes: fitnessActivity.totalDurationMinutes,
        workoutCountLastNDays: fitnessActivity.workoutCount,
        periodDays: fitnessActivity.periodDays,
      },
      wellbeing: {
        averageMoodLastNDays: moodData.averageMoodLastNDays,
        moodRatingsCountLastNDays: moodData.moodRatingsCountLastNDays,
        periodDays: moodData.periodDays,
      },
    };

    return NextResponse.json(overviewData);

  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics overview' }, { status: 500 });
  }
}

/*
== Data Export Structure Definitions (Conceptual) ==

1. CSV Export for Habit Logs:
   - Fields: Date (YYYY-MM-DD), HabitName, HabitType (GOOD/BAD), GoalType, LoggedStatus (Success/Failure/Skipped), Notes (optional), Count (if applicable)
   - Example:
     Date,HabitName,HabitType,GoalType,LoggedStatus,Notes,Count
     2023-10-26,Morning Run,GOOD,DAILY,Success,"Felt great",1
     2023-10-26,No Sugar,BAD,DAILY,Failure,"Had a cookie",1

2. JSON Export for Full User Data (High-Level Structure):
{
  "userId": "user_id_here",
  "exportDate": "YYYY-MM-DDTHH:mm:ssZ",
  "profile": {
    "name": "User Name",
    "email": "user@example.com",
    "createdAt": "...",
    "personalPhilosophy": "..."
  },
  "skills": [
    { "id", "name", "description", "currentXp", "currentLevel", "targetXpForNextLevel", "createdAt", "decayEnabled", "decayRate", "decayIntervalDays", "lastDecayCheck",
      "logs": [ { "timestamp", "xpChange", "newXp", "newLevel", "reason" } ]
    }
  ],
  "skillTrees": [
    { "id", "name", "description",
      "nodes": [ { "id", "skillId", "xPos", "yPos", "parentId", "customName", "customColor" } ]
    }
  ],
  "quests": [
    { "id", "title", "description", "type", "status", "xpReward", "createdAt", "completedAt", "failedAt", "deadline",
      "dependencies": [ { "type", "skillId", "targetLevel", "targetXp", "isCompleted", ... } ],
      "logs": [ { "timestamp", "statusChange", "details" } ]
    }
  ],
  "achievements": [
    { "achievementId", "name", "description", "criteria", "unlockedAt" }
  ],
  "habits": [
    { "id", "name", "description", "type", "goalType", "frequency", "periodInDays", "tags", "archived", "createdAt",
      "currentStreak", "longestStreak", "successCount", "totalLogCount", "lastLoggedDate",
      "logs": [ { "date", "isSuccess", "note", "count" } ]
    }
  ],
  "journalEntries": [
    { "id", "date", "content", "createdAt", "updatedAt" }
  ],
  "dailyRatings": [
    { "id", "date", "category", "value", "notes", "createdAt" } // e.g. category: MOOD, value: 4
  ],
  "fitness": {
    "workoutSessions": [
      { "id", "name", "startTime", "durationMinutes", "notes", "mood", "perceivedEffort",
        "exercises": [ { "exerciseId", "name", "type", "sets": [ { "setNumber", "reps", "weightKg", "durationSeconds", "distanceKm", "notes" } ] } ]
      }
    ],
    "bodyMetrics": [
      { "id", "date", "weightKg", "bodyFatPercentage", "notes" }
    ],
    "sleepLogs": [
      { "id", "sleepTime", "wakeTime", "qualityRating", "notes", "durationHours" }
    ]
  }
  // Any other user-specific data
}
*/
