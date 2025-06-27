// Summary: API route for managing an individual Tag (DELETE, potentially PATCH later).
// TODO: Implement PATCH if tag name/color updates are needed.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// DELETE /api/tags/[tagId] - Delete a tag for the authenticated user
export async function DELETE(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { tagId } = params;

  if (!tagId) {
    return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
  }

  try {
    // Verify the tag exists and belongs to the user before deleting
    const tag = await prisma.tag.findUnique({
      where: { id: tagId, userId: userId },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found or access denied' }, { status: 404 });
    }

    // Deleting the tag will also cascade delete entries in HabitTag and QuestTag
    // due to the onDelete: Cascade in their schema definitions.
    await prisma.tag.delete({
      where: { id: tagId },
    });

    return NextResponse.json({ message: `Tag "${tag.name}" deleted successfully.` }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting tag ${tagId}:`, error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}

// PATCH /api/tags/[tagId] - Update a tag (e.g., name, color)
// Example structure if needed later:
/*
interface TagUpdateInput {
  name?: string;
  color?: string | null;
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { tagId } = params;

  let body;
  try { body = await req.json(); }
  catch (error) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ... validation for TagUpdateInput ...
  // const { name, color } = validatedData;

  try {
    const tag = await prisma.tag.findUnique({ where: { id: tagId, userId }});
    if (!tag) return NextResponse.json({ error: 'Tag not found or access denied'}, { status: 404 });

    // If updating name, check for uniqueness conflict with other tags of the same user
    // if (name && name !== tag.name) {
    //   const existing = await prisma.tag.findUnique({ where: { userId_name: { userId, name } } });
    //   if (existing) return NextResponse.json({ error: `Tag "${name}" already exists.`}, { status: 409 });
    // }

    const updatedTag = await prisma.tag.update({
      where: { id: tagId },
      data: { name: name || undefined, color: color }, // only update provided fields
    });
    return NextResponse.json(updatedTag);
  } catch (error) {
    // ... error handling, including P2002 for unique constraint if name is updated ...
    return NextResponse.json({ error: 'Failed to update tag'}, { status: 500 });
  }
}
*/
