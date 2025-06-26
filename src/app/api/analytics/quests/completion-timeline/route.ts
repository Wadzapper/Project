import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestStatus, QuestType } from '@prisma/client'; // Added QuestType
import { subDays, startOfDay, endOfDay, eachDayOfInterval, formatISO, parseISO, startOfWeek, startOfMonth, startOfYear, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '30d';
  const groupBy = searchParams.get('groupBy') || 'day';
  const questTypeParam = searchParams.get('questType') as QuestType | null;

  let startDate: Date;
  const today = new Date();
  const veryEndDate = endOfDay(today); // Use end of today for all calculations

  switch (period) {
    case '7d': startDate = startOfDay(subDays(veryEndDate, 6)); break;
    case '30d': startDate = startOfDay(subDays(veryEndDate, 29)); break;
    case '90d': startDate = startOfDay(subDays(veryEndDate, 89)); break;
    case '1y': startDate = startOfDay(subDays(veryEndDate, 364)); break;
    case 'all':
      const firstQuestLog = await prisma.questLog.findFirst({
        where: { userId, statusChange: `STATUS_CHANGED_TO_${QuestStatus.COMPLETED}` }, // Consider completedAt on Quest model too
        orderBy: { createdAt: 'asc' },
      });
      startDate = firstQuestLog ? startOfDay(firstQuestLog.createdAt) : startOfDay(subDays(veryEndDate, 29));
      break;
    default: startDate = startOfDay(subDays(veryEndDate, 29));
  }

  try {
    const whereClause: any = {
      userId,
      status: QuestStatus.COMPLETED,
      completedAt: {
        gte: startDate,
        lte: veryEndDate,
      },
    };
    if (questTypeParam && Object.values(QuestType).includes(questTypeParam)) {
      whereClause.type = questTypeParam;
    }

    const completedQuests = await prisma.quest.findMany({
      where: whereClause,
      select: { completedAt: true }, // Only need completedAt for this timeline
      orderBy: { completedAt: 'asc' },
    });

    const timelineData = new Map<string, number>();
    let interval: Date[];
    let dateFormat: string;

    if (groupBy === 'day') {
      interval = eachDayOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM-dd';
    } else if (groupBy === 'week') {
      interval = eachWeekOfInterval({ start: startDate, end: veryEndDate }, { weekStartsOn: 1 });
      dateFormat = 'yyyy-ww'; // ISO week number
    } else { // month
      interval = eachMonthOfInterval({ start: startDate, end: veryEndDate });
      dateFormat = 'yyyy-MM';
    }

    interval.forEach(date => timelineData.set(format(date, dateFormat), 0));

    completedQuests.forEach(quest => {
      if (quest.completedAt) {
        let key: string;
        if (groupBy === 'day') key = format(quest.completedAt, dateFormat);
        else if (groupBy === 'week') key = format(quest.completedAt, dateFormat); // date-fns format 'ww' gives week of year
        else key = format(quest.completedAt, dateFormat); // 'yyyy-MM' for month

        timelineData.set(key, (timelineData.get(key) || 0) + 1);
      }
    });

    const chartData = Array.from(timelineData.entries()).map(([date, count]) => ({ date, count }));
    // Sort if not already sorted by interval generation (Map iteration order is insertion order)
    chartData.sort((a,b) => parseISO(a.date.substring(0,10)).getTime() - parseISO(b.date.substring(0,10)).getTime());


    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Error fetching quest completion timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch quest completion timeline' }, { status: 500 });
  }
}
