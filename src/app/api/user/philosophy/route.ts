import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Assuming this gives us the session with user.id
import { prisma } from '@/lib/db';

interface PhilosophyUpdateInput {
  personalPhilosophy: string;
}

// GET /api/user/philosophy - Optional: if not easily available in session
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { personalPhilosophy: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ personalPhilosophy: user.personalPhilosophy || '' });
  } catch (error) {
    console.error('Error fetching personal philosophy:', error);
    return NextResponse.json({ error: 'Failed to fetch personal philosophy' }, { status: 500 });
  }
}


// PATCH /api/user/philosophy - Update user's personal philosophy
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PhilosophyUpdateInput;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  if (typeof body.personalPhilosophy !== 'string') {
    return NextResponse.json({ error: 'Invalid input: personalPhilosophy must be a string.' }, { status: 400 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        personalPhilosophy: body.personalPhilosophy,
      },
      select: { // Select only what's needed to confirm update, or the new philosophy
        id: true,
        personalPhilosophy: true,
      }
    });
    return NextResponse.json({
        message: 'Personal philosophy updated successfully.',
        personalPhilosophy: updatedUser.personalPhilosophy
    });
  } catch (error) {
    console.error('Error updating personal philosophy:', error);
    return NextResponse.json({ error: 'Failed to update personal philosophy' }, { status: 500 });
  }
}
