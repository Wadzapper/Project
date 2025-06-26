import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { AchievementUnlockCriterionType, QuestType } from '@prisma/client';

// Helper to check for admin (temporary MVP solution)
async function isAdmin(userId: string): Promise<boolean> {
  if (!process.env.ADMIN_EMAIL) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.email === process.env.ADMIN_EMAIL;
}

interface AchievementInput {
  name: string;
  description: string;
  icon?: string;
  pointsAwarded?: number;
  criteriaType: AchievementUnlockCriterionType;
  criteriaTargetSkillId?: string;
  criteriaTargetSkillLevel?: number;
  criteriaTargetQuestCount?: number;
  criteriaTargetQuestType?: QuestType;
  criteriaTargetSkillMasteryCount?: number;
}

function validateAchievementInput(data: any): { isValid: boolean; errors?: any; data?: AchievementInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    return { isValid: false, errors: { description: 'Description is required.' } };
  }
  if (!data.criteriaType || !Object.values(AchievementUnlockCriterionType).includes(data.criteriaType)) {
    return { isValid: false, errors: { criteriaType: 'Invalid criteria type.' } };
  }
  // Add more specific validation based on criteriaType if needed
  return { isValid: true, data: data as AchievementInput };
}

// GET /api/achievements - List all global achievement definitions
export async function GET(req: NextRequest) {
  // No auth needed to view available achievements, or could be user-restricted
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}

// POST /api/achievements - Create a new global achievement (Admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
  }

  let body: AchievementInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateAchievementInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const data = validation.data;

  try {
    const newAchievement = await prisma.achievement.create({
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        pointsAwarded: data.pointsAwarded || 0,
        criteriaType: data.criteriaType,
        criteriaTargetSkillId: data.criteriaTargetSkillId,
        criteriaTargetSkillLevel: data.criteriaTargetSkillLevel,
        criteriaTargetQuestCount: data.criteriaTargetQuestCount,
        criteriaTargetQuestType: data.criteriaTargetQuestType,
        criteriaTargetSkillMasteryCount: data.criteriaTargetSkillMasteryCount,
      },
    });
    return NextResponse.json(newAchievement, { status: 201 });
  } catch (error: any) {
    console.error('Error creating achievement:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return NextResponse.json({ error: 'Achievement name must be unique' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create achievement' }, { status: 500 });
  }
}
