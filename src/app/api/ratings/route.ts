import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface DailyRatingInput {
  date: string; // YYYY-MM-DD format expected from client
  productivity: number;
  mood: number;
  energy: number;
  stress?: number | null;
  focus?: number | null;
  notes?: string | null;
}

// Basic validation for rating values (e.g., 1-5 or 1-10 scale)
function validateRatingValue(value: number, min = 1, max = 5): boolean {
    return Number.isInteger(value) && value >= min && value <= max;
}

function validateDailyRatingInput(data: any): { isValid: boolean; errors?: any; data?: DailyRatingInput } {
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required.' } };
  }
  if (data.productivity === undefined || !validateRatingValue(data.productivity)) {
    return { isValid: false, errors: { productivity: 'Productivity rating must be an integer between 1 and 5.' } };
  }
  if (data.mood === undefined || !validateRatingValue(data.mood)) {
    return { isValid: false, errors: { mood: 'Mood rating must be an integer between 1 and 5.' } };
  }
  if (data.energy === undefined || !validateRatingValue(data.energy)) {
    return { isValid: false, errors: { energy: 'Energy rating must be an integer between 1 and 5.' } };
  }
  if (data.stress !== undefined && data.stress !== null && !validateRatingValue(data.stress)) {
    return { isValid: false, errors: { stress: 'Stress rating must be an integer between 1 and 5 or null.' } };
  }
  if (data.focus !== undefined && data.focus !== null && !validateRatingValue(data.focus)) {
    return { isValid: false, errors: { focus: 'Focus rating must be an integer between 1 and 5 or null.' } };
  }
  return { isValid: true, data: data as DailyRatingInput };
}

// GET /api/ratings - Fetch ratings for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate');     // YYYY-MM-DD

  const whereClause: any = { userId: session.user.id };

  if (startDateParam) {
    // Ensure date is start of day UTC for consistent querying
    const startDate = new Date(startDateParam);
    startDate.setUTCHours(0,0,0,0);
    whereClause.date = { ...whereClause.date, gte: startDate };
  }
  if (endDateParam) {
    const endDate = new Date(endDateParam);
    endDate.setUTCHours(23,59,59,999); // End of day for inclusive range
    whereClause.date = { ...whereClause.date, lte: endDate };
  }

  try {
    const ratings = await prisma.dailyRating.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }, // Typically chronological for charts
    });
    return NextResponse.json(ratings);
  } catch (error) {
    console.error('Error fetching daily ratings:', error);
    return NextResponse.json({ error: 'Failed to fetch daily ratings' }, { status: 500 });
  }
}


// POST /api/ratings - Create or update a daily rating (upsert)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: DailyRatingInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateDailyRatingInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { date, productivity, mood, energy, stress, focus, notes } = validation.data;

  // Normalize date to represent the start of the day in UTC for consistent storage and querying
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  try {
    const upsertedRating = await prisma.dailyRating.upsert({
      where: {
        userId_date: { // Using the @@unique constraint
          userId: session.user.id,
          date: targetDate,
        },
      },
      update: {
        productivity,
        mood,
        energy,
        stress: stress === undefined ? null : stress, // Handle optional fields explicitly
        focus: focus === undefined ? null : focus,
        notes: notes === undefined ? null : notes,
      },
      create: {
        userId: session.user.id,
        date: targetDate,
        productivity,
        mood,
        energy,
        stress: stress === undefined ? null : stress,
        focus: focus === undefined ? null : focus,
        notes: notes === undefined ? null : notes,
      },
    });
    return NextResponse.json(upsertedRating, { status: 200 }); // 200 for upsert that might update, 201 if always create
  } catch (error) {
    console.error('Error creating/updating daily rating:', error);
    return NextResponse.json({ error: 'Failed to save daily rating' }, { status: 500 });
  }
}
