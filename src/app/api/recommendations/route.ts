// Summary: API endpoint for fetching habit or quest recommendations.
// TODO: Implement more sophisticated recommendation logic (e.g., collaborative filtering, content-based filtering).
// TODO: For quest recommendations, refine "weakest skill" logic and how quests are linked (dependencies vs. tags).
// TODO: For habit recommendations, integrate with skill system or user goals once those links are stronger.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Quest, Habit, Skill, QuestStatus, QuestType, HabitType, HabitGoalType } from '@prisma/client';

interface RecommendedItem {
  id: string; // Could be actual ID or a special ID for a template/predefined item
  name: string; // Or title for quests
  description?: string | null;
  type: string; // QuestType or HabitType
  linkedSkills?: { id: string; name: string }[];
  // Additional fields for instantiation if needed
  isTemplate?: boolean;
  xpReward?: number | null; // For quests
  goalType?: HabitGoalType | string; // For habits
}

// Predefined Habit Suggestions for MVP
const predefinedHabitSuggestions: Omit<RecommendedItem, 'id' | 'linkedSkills' | 'isTemplate'>[] = [
  { name: "Daily Journaling", description: "Reflect on your day for 5-10 minutes.", type: HabitType.GOOD, goalType: HabitGoalType.DAILY },
  { name: "Read 10 Pages", description: "Expand your knowledge by reading daily.", type: HabitType.GOOD, goalType: HabitGoalType.DAILY },
  { name: "Morning Hydration", description: "Drink a glass of water upon waking up.", type: HabitType.GOOD, goalType: HabitGoalType.DAILY },
  { name: "Limit Social Media", description: "Reduce screen time on social platforms before bed.", type: HabitType.BAD, goalType: HabitGoalType.DAILY },
];

// Predefined Quest Suggestions for MVP (if no skill-based can be found)
const predefinedQuestSuggestions: Omit<RecommendedItem, 'id' | 'linkedSkills' | 'isTemplate' >[] = [
    { name: "Plan Your Week", description: "Outline your tasks and goals for the upcoming week.", type: QuestType.WEEKLY_TARGET, xpReward: 50 },
    { name: "Learn a New Recipe", description: "Cook a dish you've never tried before.", type: QuestType.ONE_TIME, xpReward: 75 },
    { name: "30-Minute Focus Block", description: "Dedicate 30 minutes of uninterrupted work on a key task.", type: QuestType.DAILY_TASK, xpReward: 25 },
];


export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type'); // 'quests' or 'habits'

  if (!type || (type !== 'quests' && type !== 'habits')) {
    return NextResponse.json({ error: 'Invalid or missing "type" parameter. Use "quests" or "habits".' }, { status: 400 });
  }

  let recommendations: RecommendedItem[] = [];

  try {
    if (type === 'quests') {
      // 1. Fetch user's skills, sorted by XP ascending (weakest first)
      const userSkills = await prisma.skill.findMany({
        where: { userId },
        orderBy: { currentXp: 'asc' }, // Could also use level, or a combination
        select: { id: true, name: true, currentXp: true, currentLevel: true },
      });

      const N_WEAKEST_SKILLS = 2;
      const weakestSkillIds = userSkills.slice(0, N_WEAKEST_SKILLS).map(s => s.id);

      let skillBasedQuests: RecommendedItem[] = [];

      if (weakestSkillIds.length > 0) {
        const potentialQuests = await prisma.quest.findMany({
          where: {
            userId: userId,
            status: { notIn: [QuestStatus.COMPLETED, QuestStatus.FAILED, QuestStatus.CANCELLED] },
            dependencies: {
              some: {
                skillId: { in: weakestSkillIds },
                // type: QuestDependencyType.SKILL_TARGET_LEVEL // Or other relevant types
              },
            },
            // Ensure it's not a quest template itself, if that's a separate model
            // For now, assuming these are regular quests.
          },
          include: {
            dependencies: {
              where: { skillId: { in: weakestSkillIds } },
              include: { skill: { select: { id: true, name: true } } },
            },
          },
          take: 3, // Max 3 recommendations
        });

        skillBasedQuests = potentialQuests.map(q => ({
          id: q.id,
          name: q.title,
          description: q.description,
          type: q.type,
          xpReward: q.xpReward,
          linkedSkills: q.dependencies
            .filter(dep => dep.skillId && weakestSkillIds.includes(dep.skillId))
            .map(dep => dep.skill!) // skill should be present due to include
            .filter((skill, index, self) => skill && self.findIndex(s => s.id === skill.id) === index) // Unique skills
            .map(skill => ({id: skill.id, name: skill.name})),
          isTemplate: false,
        }));
      }

      recommendations = skillBasedQuests;
      // If not enough skill-based quests, fill with predefined ones
      if (recommendations.length < 3) {
        const numNeeded = 3 - recommendations.length;
        const predefinedToAdd = predefinedQuestSuggestions
            .filter(pq => !recommendations.some(rec => rec.name === pq.name)) // Avoid duplicates
            .slice(0, numNeeded)
            .map((pq, i) => ({...pq, id: `predefined-quest-${i}`}));
        recommendations.push(...predefinedToAdd);
      }


    } else if (type === 'habits') {
      // MVP: Return predefined habit suggestions
      // Future: Could base this on skills if habits get linked to skills,
      // or on user goals, or on least practiced habits.
      recommendations = predefinedHabitSuggestions.map((ph, i) => ({
        ...ph,
        id: `predefined-habit-${i}`, // Give them some ID
        linkedSkills: [], // No skill links for predefined habits in MVP
        isTemplate: false, // Assuming these are direct data, not templates
      }));
      recommendations = recommendations.slice(0, 3); // Ensure only 3
    }

    return NextResponse.json(recommendations);

  } catch (error) {
    console.error(`Error fetching ${type} recommendations:`, error);
    return NextResponse.json({ error: `Failed to fetch ${type} recommendations` }, { status: 500 });
  }
}
