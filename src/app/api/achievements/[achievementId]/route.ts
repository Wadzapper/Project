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

interface AchievementUpdateInput {
  name?: string;
  description?: string;
  icon?: string;
  pointsAwarded?: number;
  criteriaType?: AchievementUnlockCriterionType;
  criteriaTargetSkillId?: string | null; // Allow unsetting
  criteriaTargetSkillLevel?: number | null;
  criteriaTargetQuestCount?: number | null;
  criteriaTargetQuestType?: QuestType | null;
  criteriaTargetSkillMasteryCount?: number | null;
}

function validateAchievementUpdateInput(data: any): { isValid: boolean; errors?: any; data?: AchievementUpdateInput } {
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return { isValid: false, errors: { name: 'Name cannot be empty if provided.' } };
  }
  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.trim().length === 0)) {
    return { isValid: false, errors: { description: 'Description cannot be empty if provided.' } };
  }
  if (data.criteriaType !== undefined && !Object.values(AchievementUnlockCriterionType).includes(data.criteriaType)) {
    return { isValid: false, errors: { criteriaType: 'Invalid criteria type.' } };
  }
  // Add more specific validation based on criteriaType if needed
  return { isValid: true, data: data as AchievementUpdateInput };
}


// PATCH /api/achievements/[achievementId] - Update an achievement definition (Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { achievementId: string } }
) {
  const session = await auth();
  if (!session?.user?.id || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
  }
  const { achievementId } = params;

  let body: AchievementUpdateInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateAchievementUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  const updateData = validation.data;

  try {
    const existingAchievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existingAchievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    const updatedAchievement = await prisma.achievement.update({
      where: { id: achievementId },
      data: {
        name: updateData.name,
        description: updateData.description,
        icon: updateData.icon,
        pointsAwarded: updateData.pointsAwarded,
        criteriaType: updateData.criteriaType,
        criteriaTargetSkillId: updateData.criteriaTargetSkillId,
        criteriaTargetSkillLevel: updateData.criteriaTargetSkillLevel,
        criteriaTargetQuestCount: updateData.criteriaTargetQuestCount,
        criteriaTargetQuestType: updateData.criteriaTargetQuestType,
        criteriaTargetSkillMasteryCount: updateData.criteriaTargetSkillMasteryCount,
      },
    });
    return NextResponse.json(updatedAchievement);
  } catch (error: any) {
    console.error(`Error updating achievement ${achievementId}:`, error);
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return NextResponse.json({ error: 'Achievement name must be unique' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update achievement' }, { status: 500 });
  }
}

// DELETE /api/achievements/[achievementId] - Delete an achievement definition (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { achievementId: string } }
) {
  const session = await auth();
  if (!session?.user?.id || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
  }
  const { achievementId } = params;

  try {
    const existingAchievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existingAchievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    // Deleting an achievement will cascade to UserAchievement records by schema design
    await prisma.achievement.delete({ where: { id: achievementId } });
    return NextResponse.json({ message: 'Achievement deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting achievement ${achievementId}:`, error);
    return NextResponse.json({ error: 'Failed to delete achievement' }, { status: 500 });
  }
}
