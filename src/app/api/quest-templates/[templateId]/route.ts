// Summary: API routes for managing individual Quest Templates (GET, PATCH, DELETE).
// TODO: DELETE should ideally be a soft delete (archive/unarchive).
// TODO: PATCH validation can be more granular.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestType, QuestDependencyType, QuestStatus } from '@prisma/client'; // For instantiation

interface QuestTemplateUpdateInput {
  title?: string;
  description?: string | null;
  type?: QuestType;
  xpReward?: number | null;
  linkedSkillIds?: string[] | null;
  isArchived?: boolean;
}

// Basic validation, can be expanded
function validateQuestTemplateUpdateInput(data: any): { isValid: boolean; errors?: any; data?: QuestTemplateUpdateInput } {
  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
    return { isValid: false, errors: { title: 'Title cannot be empty if provided.' } };
  }
  if (data.type !== undefined && !Object.values(QuestType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid quest type.' } };
  }
   if (data.linkedSkillIds !== undefined && data.linkedSkillIds !== null &&
      (!Array.isArray(data.linkedSkillIds) || !data.linkedSkillIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { linkedSkillIds: 'Linked Skill IDs must be an array of strings.' } };
  }
  if (data.isArchived !== undefined && typeof data.isArchived !== 'boolean') {
    return { isValid: false, errors: { isArchived: 'isArchived must be a boolean.'}};
  }
  return { isValid: true, data: data as QuestTemplateUpdateInput };
}


// GET /api/quest-templates/[templateId] - Get a specific quest template
export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { templateId } = params;

  try {
    const template = await prisma.questTemplate.findUnique({
      where: { id: templateId, userId: userId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Quest template not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    console.error(`Error fetching quest template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest template' }, { status: 500 });
  }
}

// PATCH /api/quest-templates/[templateId] - Update a quest template
export async function PATCH(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { templateId } = params;

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateQuestTemplateUpdateInput(body);
  if (!validation.isValid || !validation.data || Object.keys(validation.data).length === 0) {
    return NextResponse.json({ error: 'Invalid or empty input for update', details: validation.errors }, { status: 400 });
  }
  const updateData = validation.data;

  try {
    // Verify ownership
    const existingTemplate = await prisma.questTemplate.findUnique({
      where: { id: templateId, userId: userId },
    });
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Quest template not found or access denied' }, { status: 404 });
    }

    // Optional: Validate linkedSkillIds if provided in updateData
    if (updateData.linkedSkillIds && updateData.linkedSkillIds.length > 0) {
      const skillsCount = await prisma.skill.count({
        where: { id: { in: updateData.linkedSkillIds }, userId: userId },
      });
      if (skillsCount !== updateData.linkedSkillIds.length) {
        return NextResponse.json({ error: 'One or more updated linked skill IDs are invalid or do not belong to the user.' }, { status: 400 });
      }
    }

    const updatedTemplate = await prisma.questTemplate.update({
      where: { id: templateId },
      data: updateData,
    });
    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error(`Error updating quest template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to update quest template' }, { status: 500 });
  }
}

// DELETE /api/quest-templates/[templateId] - Archive/Unarchive a quest template (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { templateId } = params;

  try {
    const existingTemplate = await prisma.questTemplate.findUnique({
      where: { id: templateId, userId: userId },
    });
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Quest template not found or access denied' }, { status: 404 });
    }

    // Toggle archive status
    const updatedTemplate = await prisma.questTemplate.update({
      where: { id: templateId },
      data: { isArchived: !existingTemplate.isArchived },
    });

    const message = updatedTemplate.isArchived ? 'Quest template archived.' : 'Quest template unarchived.';
    return NextResponse.json({ message, template: updatedTemplate });

  } catch (error) {
    console.error(`Error archiving/unarchiving quest template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to update quest template archive status' }, { status: 500 });
  }
}
