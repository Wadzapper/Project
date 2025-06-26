import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { PathStepType } from '@prisma/client'; // Assuming PathStepType enum is generated

interface PathStepInput {
  order?: number; // Optional: if not provided, append to the end
  type: PathStepType; // SKILL or QUEST
  skillId?: string | null;
  questId?: string | null;
  notes?: string | null;
}

function validatePathStepInput(data: any): { isValid: boolean; errors?: any; data?: PathStepInput } {
  if (!data.type || !Object.values(PathStepType).includes(data.type)) {
    return { isValid: false, errors: { type: 'Invalid step type. Must be SKILL or QUEST.' } };
  }
  if (data.type === PathStepType.SKILL && (!data.skillId || typeof data.skillId !== 'string')) {
    return { isValid: false, errors: { skillId: 'Skill ID is required for SKILL type steps.' } };
  }
  if (data.type === PathStepType.QUEST && (!data.questId || typeof data.questId !== 'string')) {
    return { isValid: false, errors: { questId: 'Quest ID is required for QUEST type steps.' } };
  }
  if (data.order !== undefined && (typeof data.order !== 'number' || data.order < 0)) {
    return { isValid: false, errors: { order: 'Order must be a non-negative number.' } };
  }
   if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    return { isValid: false, errors: { notes: 'Notes must be a string.' } };
  }
  return { isValid: true, data: data as PathStepInput };
}

// POST /api/paths/[pathId]/steps - Add a new step to a specific path
export async function POST(
  req: NextRequest,
  { params }: { params: { pathId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { pathId } = params;

  if (!pathId) {
    return NextResponse.json({ error: 'Path ID is required' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validatePathStepInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input for path step', details: validation.errors }, { status: 400 });
  }

  const { type, skillId, questId, order, notes } = validation.data;

  try {
    // Verify user owns the path
    const path = await prisma.path.findUnique({
      where: { id: pathId, userId: userId },
      include: { _count: { select: { steps: true } } } // Get current number of steps
    });
    if (!path) {
      return NextResponse.json({ error: 'Path not found or access denied' }, { status: 404 });
    }

    // Validate referenced skill/quest exists and belongs to user (important!)
    if (type === PathStepType.SKILL && skillId) {
      const skill = await prisma.skill.findUnique({ where: { id: skillId, userId: userId } });
      if (!skill) return NextResponse.json({ error: 'Skill not found or access denied.' }, { status: 404 });
    } else if (type === PathStepType.QUEST && questId) {
      const quest = await prisma.quest.findUnique({ where: { id: questId, userId: userId } });
      if (!quest) return NextResponse.json({ error: 'Quest not found or access denied.' }, { status: 404 });
    } else if (type === PathStepType.SKILL && !skillId) {
        return NextResponse.json({ error: 'skillId is required for SKILL type step.' }, { status: 400 });
    } else if (type === PathStepType.QUEST && !questId) {
        return NextResponse.json({ error: 'questId is required for QUEST type step.' }, { status: 400 });
    }


    let stepOrder = order;
    if (stepOrder === undefined || stepOrder === null) {
      // If order is not provided, append to the end
      stepOrder = path._count.steps; // This gives the count, so next order is this count (0-indexed)
    } else {
      // If order is provided, we might need to shift existing steps if not handling reordering yet.
      // For MVP, let's assume client provides a valid, non-conflicting order or appends.
      // A true reordering or inserting at specific order would require more logic.
      // For now, if order is provided, we use it. Prisma's unique constraint on (pathId, order) will catch conflicts.
    }

    const newStep = await prisma.pathStep.create({
      data: {
        pathId: pathId,
        order: stepOrder,
        type: type,
        skillId: type === PathStepType.SKILL ? skillId : null,
        questId: type === PathStepType.QUEST ? questId : null,
        completed: false, // Default to not completed
        notes: notes || null,
      },
    });
    return NextResponse.json(newStep, { status: 201 });
  } catch (error: any) {
    console.error(`Error adding step to path ${pathId}:`, error);
    if (error.code === 'P2002' && error.meta?.target?.includes('order')) {
        return NextResponse.json({ error: 'A step with this order already exists for this path.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add step to path' }, { status: 500 });
  }
}
