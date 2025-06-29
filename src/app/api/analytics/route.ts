// src/app/api/analytics/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, QuestStatus, QuestPriority, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'Query parameter "userId" is required.' }, { status: 400 });
  }

  try {
    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: `User with ID ${userId} not found.` }, { status: 404 });
    }

    // 1. Quests Stats
    const quests = await prisma.quest.findMany({ where: { userId } });
    const totalQuests = quests.length;
    const completedQuestsCount = quests.filter(q => q.status === QuestStatus.COMPLETED).length;
    const questsCompletionPercentage = totalQuests > 0 ? Math.round((completedQuestsCount / totalQuests) * 100) : 0;

    const questStatusCounts = quests.reduce((acc, quest) => {
      acc[quest.status] = (acc[quest.status] || 0) + 1;
      return acc;
    }, {} as Record<QuestStatus, number>);

    const questPriorityCounts = quests.reduce((acc, quest) => {
      acc[quest.priority] = (acc[quest.priority] || 0) + 1;
      return acc;
    }, {} as Record<QuestPriority, number>);

    const questStatusChartData = {
        labels: Object.keys(questStatusCounts),
        datasets: [{
            data: Object.values(questStatusCounts),
            // backgroundColor can be added here if needed by chart lib
        }]
    };
     const questPriorityChartData = {
        labels: Object.keys(questPriorityCounts),
        datasets: [{
            data: Object.values(questPriorityCounts),
        }]
    };


    // 2. Skills Stats
    const skills = await prisma.skill.findMany({ where: { userId } });
    const totalSkills = skills.length;
    let averageSkillLevel = 0;
    let highestLevelSkill = null;
    if (totalSkills > 0) {
      const sumOfLevels = skills.reduce((sum, skill) => sum + skill.level, 0);
      averageSkillLevel = Math.round(sumOfLevels / totalSkills);
      highestLevelSkill = skills.reduce((max, skill) => skill.level > max.level ? skill : max, skills[0]);
    }

    // 3. Habits Stats (Placeholder logic for streaks as it's complex)
    // For a real implementation, streak calculation needs careful daily tracking.
    // Here, we'll use the stored streak values.
    const habits = await prisma.habit.findMany({ where: { userId } });
    let longestCurrentStreak = 0;
    let overallLongestStreak = 0;
    if (habits.length > 0) {
        longestCurrentStreak = Math.max(...habits.map(h => h.streak), 0);
        overallLongestStreak = Math.max(...habits.map(h => h.longestStreak), 0);
    }

    // 4. Paths Stats
    const paths = await prisma.path.findMany({
        where: { userId },
        include: { steps: { select: { completed: true } } }
    });
    const totalPaths = paths.length;
    let averagePathCompletion = 0;
    if (totalPaths > 0) {
        const sumOfPathCompletions = paths.reduce((sum, path) => {
            const completedSteps = path.steps.filter(s => s.completed).length;
            return sum + (path.steps.length > 0 ? (completedSteps / path.steps.length) * 100 : 0);
        }, 0);
        averagePathCompletion = Math.round(sumOfPathCompletions / totalPaths);
    }


    return NextResponse.json({
      userId,
      totalQuests,
      completedQuestsCount,
      questsCompletionPercentage,
      questStatusCounts, // Raw counts
      questPriorityCounts, // Raw counts
      questStatusChartData, // Formatted for charts
      questPriorityChartData, // Formatted for charts
      totalSkills,
      averageSkillLevel,
      highestLevelSkill: highestLevelSkill ? { name: highestLevelSkill.name, level: highestLevelSkill.level } : null,
      longestCurrentHabitStreak: longestCurrentStreak, // Based on stored current streaks
      overallLongestHabitStreak: overallLongestStreak, // Based on stored overall longest streaks
      totalPaths,
      averagePathCompletionPercentage: averagePathCompletion,
    });

  } catch (error) {
    console.error(`Error fetching analytics for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error fetching analytics', error: errorMessage }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error fetching analytics', error: errorMessage }, { status: 500 });
  }
}
