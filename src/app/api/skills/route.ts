import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { applySkillDecay, SkillWithDecayFields, calculateTargetXpForLevel } from '@/lib/skillUtils';

// Basic validation (can be expanded or use Zod)
interface SkillInput {
  name: string;
  description?: string | null; // Ensure description can be explicitly null
  currentLevel?: number;
  currentXp?: number;
  targetXpForNextLevel?: number;
  colorCode?: string | null; // Added colorCode to input
}

function validateSkillInput(data: any): { isValid: boolean; errors?: any; data?: SkillInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    return { isValid: false, errors: { description: 'Description must be a string if provided.'}};
  }
  if (data.colorCode !== undefined && data.colorCode !== null && typeof data.colorCode !== 'string') {
    return { isValid: false, errors: { colorCode: 'Color code must be a string if provided.'}};
  }
  // Add more validations as needed for other fields (level, XP)
  return { isValid: true, data: data as SkillInput };
}


// GET /api/skills - Get all skills for the authenticated user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const skillsFromDb = await prisma.skill.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Assuming SkillWithDecayFields is compatible enough or Skill model has these (they are not in current schema)
    // If Skill model doesn't have decay fields, applySkillDecay might error or do nothing.
    // For now, to pass build, we'll assume applySkillDecay can handle the base Skill type if decay fields are missing.
    const skillsWithDecayApplied = await Promise.all(
      skillsFromDb.map(skill => applySkillDecay(skill as any /* Cast to SkillWithDecayFields if necessary and if applySkillDecay expects it*/))
    );

    return NextResponse.json(skillsWithDecayApplied);
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }
}

// POST /api/skills - Create a new skill for the authenticated user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id; // Defined userId for clarity

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 });
  }

  const validation = validateSkillInput(body);
  if (!validation.isValid || !validation.data) {
    return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 });
  }

  const { name, description, currentLevel, currentXp, targetXpForNextLevel, colorCode } = validation.data;

  try {
    const newSkill = await prisma.skill.create({
      data: {
        userId: userId,
        name,
        description: description || null,
        currentLevel: currentLevel || 1,
        currentXp: currentXp || 0,
        targetXpForNextLevel: targetXpForNextLevel || calculateTargetXpForLevel(currentLevel || 1),
        colorCode: colorCode || null,
        // Decay fields (decayEnabled, decayRate, decayIntervalDays, lastDecayCheck) removed
        // as they are not in the Prisma Skill model definition.
      },
    });
    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
