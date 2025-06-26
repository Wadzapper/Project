import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface BodyMetricUpdateInput {
  date?: string; // ISO DateTime string
  weightKg?: number | null;
  bodyFat?: number | null;
  notes?: string | null;
}

function validateBodyMetricUpdateInput(data: any): { isValid: boolean; errors?: any; data?: BodyMetricUpdateInput } {
  if (data.date !== undefined && isNaN(new Date(data.date).getTime())) {
    return { isValid: false, errors: { date: 'Valid date is required if provided.' } };
  }
  // Allow unsetting by passing null, but if value is present, validate it
  if (data.weightKg !== undefined && data.weightKg !== null && (typeof data.weightKg !== 'number' || data.weightKg <= 0)) {
    return { isValid: false, errors: { weightKg: 'Weight must be a positive number if provided.' } };
  }
  if (data.bodyFat !== undefined && data.bodyFat !== null && (typeof data.bodyFat !== 'number' || data.bodyFat < 0 || data.bodyFat > 100)) {
    return { isValid: false, errors: { bodyFat: 'Body fat percentage must be between 0 and 100 if provided.' } };
  }
  // Ensure at least one actual metric value is being updated if only those are sent
  if (Object.keys(data).length > 0 && // if data is not empty
      data.weightKg === undefined && data.bodyFat === undefined && data.notes === undefined && data.date === undefined ) {
        // This case is tricky, usually update means at least one field to change.
        // If only date is changed, that's fine.
        // If no actual value fields, it might be an empty update.
  }
  return { isValid: true, data: data as BodyMetricUpdateInput };
}


// GET /api/metrics/[metricId] - Get a single body metric entry (Optional, usually list is enough)
export async function GET(req: NextRequest, { params }: { params: { metricId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const metric = await prisma.bodyMetric.findUnique({
      where: { id: params.metricId, userId: session.user.id },
    });
    if (!metric) return NextResponse.json({ error: 'Body metric not found or access denied' }, { status: 404 });
    return NextResponse.json(metric);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch body metric' }, { status: 500 });
  }
}


// PATCH /api/metrics/[metricId] - Update a body metric entry
export async function PATCH(req: NextRequest, { params }: { params: { metricId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: BodyMetricUpdateInput;
  try { body = await req.json(); }
  catch (e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validation = validateBodyMetricUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }

  const updatePayload: any = {};
  if (validation.data.date) updatePayload.date = new Date(validation.data.date);
  if (validation.data.weightKg !== undefined) updatePayload.weightKg = validation.data.weightKg;
  if (validation.data.bodyFat !== undefined) updatePayload.bodyFat = validation.data.bodyFat;
  if (validation.data.notes !== undefined) updatePayload.notes = validation.data.notes;


  try {
    const existingMetric = await prisma.bodyMetric.findUnique({ where: { id: params.metricId, userId: session.user.id }});
    if (!existingMetric) return NextResponse.json({ error: 'Body metric not found or access denied' }, { status: 404 });

    const updatedMetric = await prisma.bodyMetric.update({
      where: { id: params.metricId },
      data: updatePayload,
    });
    return NextResponse.json(updatedMetric);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update body metric' }, { status: 500 });
  }
}

// DELETE /api/metrics/[metricId] - Delete a body metric entry
export async function DELETE(req: NextRequest, { params }: { params: { metricId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const existingMetric = await prisma.bodyMetric.findUnique({ where: { id: params.metricId, userId: session.user.id }});
    if (!existingMetric) return NextResponse.json({ error: 'Body metric not found or access denied' }, { status: 404 });

    await prisma.bodyMetric.delete({ where: { id: params.metricId } });
    return NextResponse.json({ message: 'Body metric deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete body metric' }, { status: 500 });
  }
}
