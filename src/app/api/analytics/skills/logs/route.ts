import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const skillId = searchParams.get('skillId'); // Optional: filter by specific skill
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = (page - 1) * limit;

  try {
    const whereClause: any = { userId };
    if (skillId) {
      whereClause.skillId = skillId;
    }

    const logs = await prisma.skillProgressLog.findMany({
      where: whereClause,
      include: {
        skill: { // Include skill name for context in the log table
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const totalLogs = await prisma.skillProgressLog.count({ where: whereClause });
    const totalPages = Math.ceil(totalLogs / limit);

    return NextResponse.json({
      logs,
      currentPage: page,
      totalPages,
      totalLogs,
    });

  } catch (error) {
    console.error('Error fetching skill progress logs:', error);
    return NextResponse.json({ error: 'Failed to fetch skill progress logs' }, { status: 500 });
  }
}
