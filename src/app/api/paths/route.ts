import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Interface for Path creation input
interface PathInput {
  name: string;
  description?: string | null;
}

// Validation function for PathInput
function validatePathInput(data: any): { isValid: boolean; errors?: any; data?: PathInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Path name is required.' } };
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    return { isValid: false, errors: { description: 'Description must be a string.' } };
  }
  return { isValid: true, data: data as PathInput };
}

// GET /api/paths - Get all paths for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const paths = await prisma.path.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        // Optionally include steps count or a few steps for preview
        _count: {
          select: { steps: true }
        }
      }
    });
    return NextResponse.json(paths);
  } catch (error) {
    console.error('Error fetching paths:', error);
    return NextResponse.json({ error: 'Failed to fetch paths' }, { status: 500 });
  }
}

// POST /api/paths - Create a new path for the authenticated user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validatePathInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description } = validation.data;

  try {
    const newPath = await prisma.path.create({
      data: {
        userId: userId,
        name: name,
        description: description || null,
      },
    });
    return NextResponse.json(newPath, { status: 201 });
  } catch (error) {
    console.error('Error creating path:', error);
    return NextResponse.json({ error: 'Failed to create path' }, { status: 500 });
  }
}
