import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// GET /api/achievements/user - List achievements unlocked by the current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: session.user.id },
      include: {
        achievement: true, // Include the full achievement definition
      },
      orderBy: {
        unlockedAt: 'desc',
      },
    });
    return NextResponse.json(userAchievements);
  } catch (error) {
    console.error("Error fetching user's achievements:", error);
    return NextResponse.json({ error: "Failed to fetch user's achievements" }, { status: 500 });
  }
}
