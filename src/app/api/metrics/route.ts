import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

interface BodyMetricInput {
  date: string; // ISO DateTime string
  weightKg?: number | null;
  bodyFat?: number | null;
  notes?: string | null;
}

function validateBodyMetricInput(data: any): { isValid: boolean; errors?: any; data?: BodyMetricInput } {
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required.' } };
  }
  if (data.weightKg === undefined && data.bodyFat === undefined) { // At least one metric value required
    return { isValid: false, errors: { general: 'At least one metric (weight or body fat) must be provided.'}};
  }
  if (data.weightKg !== undefined && data.weightKg !== null && (typeof data.weightKg !== 'number' || data.weightKg <= 0)) {
    return { isValid: false, errors: { weightKg: 'Weight must be a positive number if provided.' } };
  }
  if (data.bodyFat !== undefined && data.bodyFat !== null && (typeof data.bodyFat !== 'number' || data.bodyFat < 0 || data.bodyFat > 100)) {
    return { isValid: false, errors: { bodyFat: 'Body fat percentage must be between 0 and 100 if provided.' } };
  }
  return { isValid: true, data: data as BodyMetricInput };
}

// GET /api/metrics - Fetch body metrics for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10);
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
    const bodyMetrics = await prisma.bodyMetric.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      skip: offset,
      take: limit,
    });
    const totalMetrics = await prisma.bodyMetric.count({ where: whereClause });
    const totalPages = Math.ceil(totalMetrics / limit);

    return NextResponse.json({
      metrics: bodyMetrics,
      currentPage: page,
      totalPages,
      totalMetrics,
    });
  } catch (error) {
    console.error('Error fetching body metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch body metrics' }, { status: 500 });
  }
}

// POST /api/metrics - Create a new body metric entry
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BodyMetricInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateBodyMetricInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { date, weightKg, bodyFat, notes } = validation.data;

  try {
    const newMetric = await prisma.bodyMetric.create({
      data: {
        userId: session.user.id,
        date: new Date(date), // Client sends ISO string, convert to DateTime
        weightKg: weightKg === undefined ? null : weightKg, // Handle optional fields
        bodyFat: bodyFat === undefined ? null : bodyFat,
        notes: notes || null,
      },
    });
    return NextResponse.json(newMetric, { status: 201 });
  } catch (error) {
    console.error('Error creating body metric entry:', error);
    return NextResponse.json({ error: 'Failed to create body metric entry' }, { status: 500 });
  }
}
