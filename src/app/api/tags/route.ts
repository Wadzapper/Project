// Summary: API routes for managing Tags (GET all, POST new).
// TODO: Add PATCH /api/tags/[tagId] if tag name/color updates are needed.
// TODO: Consider validation for color format if using a color picker.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

interface TagInput {
  name: string;
  color?: string | null;
}

function validateTagInput(data: any): { isValid: boolean; errors?: any; data?: TagInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Tag name is required and cannot be empty.' } };
  }
  if (data.name.length > 50) { // Example length limit
      return { isValid: false, errors: { name: 'Tag name cannot exceed 50 characters.'}};
  }
  if (data.color !== undefined && data.color !== null && (typeof data.color !== 'string' || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(data.color))) {
    // Basic hex color validation
    // return { isValid: false, errors: { color: 'Color must be a valid hex code (e.g., #RRGGBB or #RGB) or null.' } };
    // For MVP, allow any string for color, frontend color picker will ensure format.
  }
  return { isValid: true, data: data as TagInput };
}

// GET /api/tags - Get all tags for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const tags = await prisma.tag.findMany({
      where: { userId: userId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST /api/tags - Create a new tag for the authenticated user
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

  const validation = validateTagInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, color } = validation.data;

  try {
    // Check for existing tag with the same name for this user
    const existingTag = await prisma.tag.findUnique({
      where: { userId_name: { userId, name: name.trim() } }, // Uses the @@unique([userId, name])
    });
    if (existingTag) {
      return NextResponse.json({ error: `Tag "${name.trim()}" already exists.` }, { status: 409 }); // Conflict
    }

    const newTag = await prisma.tag.create({
      data: {
        userId: userId,
        name: name.trim(),
        color: color || null,
      },
    });
    return NextResponse.json(newTag, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('name') && error.meta?.target?.includes('userId')) {
        // This handles the unique constraint on (userId, name) explicitly if the findUnique above missed a race condition.
        return NextResponse.json({ error: `Tag "${name.trim()}" already exists.` }, { status: 409 });
    }
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
