import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// DELETE /api/sleep/[logId] - Delete a specific sleep log entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: { logId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { logId } = params;

  try {
    // Ensure the log exists and belongs to the user before deleting
    const sleepLog = await prisma.sleepLog.findUnique({
      where: { id: logId, userId: userId },
    });

    if (!sleepLog) {
      return NextResponse.json({ error: 'Sleep log not found or access denied' }, { status: 404 });
    }

    await prisma.sleepLog.delete({
      where: { id: logId }, // userId check already implicitly done by finding it first
    });

    return NextResponse.json({ message: 'Sleep log deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting sleep log ${logId}:`, error);
    return NextResponse.json({ error: 'Failed to delete sleep log' }, { status: 500 });
  }
}

// PATCH /api/sleep/[logId] - Optional: Update a specific sleep log entry
// For MVP, upsert by date via POST /api/sleep is likely sufficient.
// If direct editing of an existing log by its ID is needed (e.g., if date itself is immutable post-creation),
// this endpoint could be implemented similarly to other PATCH handlers.
/*
export async function PATCH(
  req: NextRequest,
  { params }: { params: { logId: string } }
) {
  // ... implementation ...
}
*/
