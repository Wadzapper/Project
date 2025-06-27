// Summary: API routes for creating and listing Quest Templates.
// TODO: Add more robust validation for input fields (e.g., length, specific values).
// TODO: Consider pagination for GET /api/quest-templates if list can become very long.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { QuestType } from '@prisma/client';

interface QuestTemplateInput {
  title: string;
  description?: string | null;
  type: QuestType;
  xpReward?: number | null;
  linkedSkillIds?: string[] | null; // Array of skill IDs
}

function validateQuestTemplateInput(data: any): { isValid: boolean; errors?: any; data?: QuestTemplateInput } {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    return { isValid: false, errors: { title: 'Title is required.' } };
  }
  if (!data.type || !Object.values(QuestType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid quest type.' } };
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    return { isValid: false, errors: { description: 'Description must be a string.' } };
  }
  if (data.xpReward !== undefined && data.xpReward !== null && (typeof data.xpReward !== 'number' || data.xpReward < 0)) {
    return { isValid: false, errors: { xpReward: 'XP Reward must be a non-negative number.' } };
  }
  if (data.linkedSkillIds !== undefined && data.linkedSkillIds !== null &&
      (!Array.isArray(data.linkedSkillIds) || !data.linkedSkillIds.every((id: any) => typeof id === 'string'))) {
    return { isValid: false, errors: { linkedSkillIds: 'Linked Skill IDs must be an array of strings.' } };
  }
  return { isValid: true, data: data as QuestTemplateInput };
}

// GET /api/quest-templates - Get all non-archived quest templates for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get('archived')?.toLowerCase() === 'true';

  try {
    const whereClause: any = { userId: userId };
    if (!includeArchived) {
      whereClause.isArchived = false;
    }

    const templates = await prisma.questTemplate.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching quest templates:', error);
    return NextResponse.json({ error: 'Failed to fetch quest templates' }, { status: 500 });
  }
}

// POST /api/quest-templates - Create a new quest template
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

  const validation = validateQuestTemplateInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { title, description, type, xpReward, linkedSkillIds } = validation.data;

  try {
    // Optional: Validate that linkedSkillIds actually exist and belong to the user
    if (linkedSkillIds && linkedSkillIds.length > 0) {
      const skillsCount = await prisma.skill.count({
        where: {
          id: { in: linkedSkillIds },
          userId: userId,
        },
      });
      if (skillsCount !== linkedSkillIds.length) {
        return NextResponse.json({ error: 'One or more linked skill IDs are invalid or do not belong to the user.' }, { status: 400 });
      }
    }

    const newTemplate = await prisma.questTemplate.create({
      data: {
        userId,
        title,
        description: description || null,
        type,
        xpReward: xpReward || 0,
        linkedSkillIds: linkedSkillIds || [],
        isArchived: false, // Default, though schema also defaults
      },
    });
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('Error creating quest template:', error);
    return NextResponse.json({ error: 'Failed to create quest template' }, { status: 500 });
  }
}
