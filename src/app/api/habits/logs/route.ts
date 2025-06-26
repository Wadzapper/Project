import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { HabitType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const habitType = searchParams.get('habitType') as HabitType | null;
  const startDateString = searchParams.get('startDate');
  const endDateString = searchParams.get('endDate');

  let dateFilter = {};
  if (startDateString) {
    const startDate = new Date(startDateString);
    if (!isNaN(startDate.getTime())) {
      dateFilter = { ...dateFilter, gte: startDate };
    } else {
      return NextResponse.json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }
  }
  if (endDateString) {
    const endDate = new Date(endDateString);
    if (!isNaN(endDate.getTime())) {
      // To include the whole end day, set time to end of day or use less than next day
      endDate.setHours(23, 59, 59, 999);
      dateFilter = { ...dateFilter, lte: endDate };
    } else {
      return NextResponse.json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }
  }

  const whereClause: any = {
    userId: userId,
  };

  if (Object.keys(dateFilter).length > 0) {
    whereClause.date = dateFilter;
  }

  // To filter by HabitType, we need to fetch logs and include their parent habit's type
  // or filter habits first and then fetch their logs.
  // Let's fetch logs and include the habit type for easier processing on the client.

  try {
    const logs = await prisma.habitLog.findMany({
      where: whereClause,
      include: {
        habit: {
          select: {
            type: true, // Select the type of the parent habit
            name: true, // Optionally, include habit name for context
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Filter by habitType if provided
    const filteredLogs = habitType
      ? logs.filter(log => log.habit.type === habitType)
      : logs;

    // Format the response to be more client-friendly if needed
    const responseLogs = filteredLogs.map(log => ({
      id: log.id,
      habitId: log.habitId,
      habitName: log.habit.name, // Included habit name
      habitType: log.habit.type, // Included habit type
      date: log.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      isSuccess: log.isSuccess,
      note: log.note,
      count: log.count,
    }));

    return NextResponse.json(responseLogs);
  } catch (error) {
    console.error('Error fetching habit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch habit logs' }, { status: 500 });
  }
}
