import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestType, QuestStatus, RatingCategory } from '@prisma/client'; // Assuming RatingCategory enum exists
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Helper function to calculate quest completion stats (similar to /api/quests/analytics)
async function getQuestCompletionStats(userId: string) {
  const allUserQuests = await prisma.quest.findMany({
    where: { userId: userId },
    select: { type: true, status: true },
  });

  const statsByType: { [key in QuestType]?: { total: number; completed: number; rate: number } } = {};
  for (const type of Object.values(QuestType)) {
    statsByType[type] = { total: 0, completed: 0, rate: 0 };
  }

  for (const quest of allUserQuests) {
    statsByType[quest.type]!.total += 1;
    if (quest.status === QuestStatus.COMPLETED) {
      statsByType[quest.type]!.completed += 1;
    }
  }

  let totalQuestsOverall = 0;
  let completedQuestsOverall = 0;

  for (const type of Object.values(QuestType)) {
    const typeStats = statsByType[type]!;
    typeStats.rate = typeStats.total > 0 ? parseFloat((typeStats.completed / typeStats.total).toFixed(2)) : 0;
    totalQuestsOverall += typeStats.total;
    completedQuestsOverall += typeStats.completed;
  }

  const overallCompletionRate = totalQuestsOverall > 0 ? parseFloat((completedQuestsOverall / totalQuestsOverall).toFixed(2)) : 0;

  return {
    byType: statsByType,
    overall: {
        total: totalQuestsOverall,
        completed: completedQuestsOverall,
        rate: overallCompletionRate,
    }
  };
}

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

    // 2. Quest Completion Stats
    const questCompletionStats = await getQuestCompletionStats(userId);

    // 3. Fitness Trends (e.g., total workout duration last 7 days)
    const sevenDaysAgo = subDays(startOfDay(new Date()), 6); // Include today, so 6 days back from start of today
    const fitnessWorkoutsLast7Days = await prisma.workoutSession.findMany({
      where: {
        userId: userId,
        startTime: { gte: sevenDaysAgo },
      },
      select: { durationMinutes: true },
    });
    const totalWorkoutDurationLast7Days = fitnessWorkoutsLast7Days.reduce(
      (sum, workout) => sum + (workout.durationMinutes || 0),
      0
    );
    const workoutCountLast7Days = fitnessWorkoutsLast7Days.length;


    // 4. Mood Scores (average daily ratings last 7 days for 'MOOD')
    // Assuming DailyRating has a 'category' (e.g. MOOD, PRODUCTIVITY) and 'ratingValue'
    const moodRatingsLast7Days = await prisma.dailyRating.findMany({
      where: {
        userId: userId,
        date: { gte: sevenDaysAgo },
        // Assuming a direct 'moodRating' field or a category system.
        // If using categories: category: RatingCategory.MOOD (adjust if schema is different)
        // For this example, let's assume a 'mood' field directly or a common 'value' field for a 'MOOD' category.
        // If your DailyRating stores multiple ratings per day (mood, productivity, etc.)
        // you'll need to filter by the specific rating type.
        // Let's assume a 'mood' specific field for simplicity here:
        // THIS IS A GUESS - actual field name may differ.
        // Replace 'moodScore' with the actual field name from your DailyRating schema.
        // If using a generic value field with categories:
        // category: RatingCategory.MOOD
        // select: { value: true }
      },
       // Assuming a generic `value` field and a `category` field
      select: { value: true, category: true }
    });

    const moodSpecificRatings = moodRatingsLast7Days
        .filter(r => r.category === RatingCategory.MOOD && r.value !== null) // Adjust RatingCategory.MOOD as per your enum
        .map(r => r.value!); // value! because we filtered for not null

    const averageMoodLast7Days =
      moodSpecificRatings.length > 0
        ? parseFloat((moodSpecificRatings.reduce((sum, rating) => sum + rating, 0) / moodSpecificRatings.length).toFixed(1))
        : null; // or 0, or a specific indicator for no data

    const overviewData = {
      skills: {
        totalXp: totalSkillXp,
        count: totalSkills,
      },
      quests: questCompletionStats,
      fitness: {
        totalDurationLast7DaysMinutes: totalWorkoutDurationLast7Days,
        workoutCountLast7Days: workoutCountLast7Days,
      },
      wellbeing: { // Or 'ratings', 'moods' etc.
        averageMoodLast7Days: averageMoodLast7Days, // (scale 1-5 or 1-10?)
        moodRatingsCountLast7Days: moodSpecificRatings.length,
      },
      // Add more aggregates as needed
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
