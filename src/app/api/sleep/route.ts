import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

interface SleepLogInput {
  date: string; // YYYY-MM-DD
  hours: number;
  quality: number; // e.g. 1-5
  notes?: string | null;
}

function validateSleepLogInput(data: any): { isValid: boolean; errors?: any; data?: SleepLogInput } {
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required.' } };
  }
  if (data.hours === undefined || typeof data.hours !== 'number' || data.hours <= 0 || data.hours > 24) {
    return { isValid: false, errors: { hours: 'Hours must be a positive number, typically not exceeding 24.' } };
  }
  if (data.quality === undefined || !Number.isInteger(data.quality) || data.quality < 1 || data.quality > 5) {
    return { isValid: false, errors: { quality: 'Quality must be an integer between 1 and 5.' } };
  }
  return { isValid: true, data: data as SleepLogInput };
}

// GET /api/sleep - Fetch sleep logs for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10); // Default to 30 for a month view
  const offset = (page - 1) * limit;

  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const whereClause: any = { userId: session.user.id };

  if (startDateParam) {
    whereClause.date = { ...whereClause.date, gte: startOfDay(new Date(startDateParam)) };
  }
  if (endDateParam) {
    whereClause.date = { ...whereClause.date, lte: endOfDay(new Date(endDateParam)) };
  }


  try {
    const sleepLogs = await prisma.sleepLog.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      skip: offset,
      take: limit,
    });
    const totalLogs = await prisma.sleepLog.count({ where: whereClause });
    const totalPages = Math.ceil(totalLogs / limit);

    return NextResponse.json({
      logs: sleepLogs,
      currentPage: page,
      totalPages,
      totalLogs,
    });
  } catch (error) {
    console.error('Error fetching sleep logs:', error);
    return NextResponse.json({ error: 'Failed to fetch sleep logs' }, { status: 500 });
  }
}

// POST /api/sleep - Upsert a sleep log for a specific date
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SleepLogInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSleepLogInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { date, hours, quality, notes } = validation.data;
  const targetDate = startOfDay(new Date(date)); // Normalize date to start of day UTC

  try {
    const upsertedLog = await prisma.sleepLog.upsert({
      where: {
        userId_date: { // Using the @@unique constraint
          userId: session.user.id,
          date: targetDate,
        },
      },
      update: { hours, quality, notes: notes || null },
      create: {
        userId: session.user.id,
        date: targetDate,
        hours,
        quality,
        notes: notes || null,
      },
    });
    return NextResponse.json(upsertedLog, { status: 200 }); // 200 for upsert
  } catch (error) {
    console.error('Error creating/updating sleep log:', error);
    return NextResponse.json({ error: 'Failed to save sleep log' }, { status: 500 });
  }
}
