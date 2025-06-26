import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { applySkillDecay, SkillWithDecayFields, calculateTargetXpForLevel } from '@/lib/skillUtils';

// Basic validation (can be expanded or use Zod)
interface SkillInput {
  name: string;
  description?: string;
  currentLevel?: number;
  currentXp?: number;
  targetXpForNextLevel?: number;
}

function validateSkillInput(data: any): { isValid: boolean; errors?: any; data?: SkillInput } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { isValid: false, errors: { name: 'Name is required.' } };
  }
  // Add more validations as needed for other fields
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

    const skillsWithDecayApplied = await Promise.all(
      skillsFromDb.map(skill => applySkillDecay(skill as SkillWithDecayFields))
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

  const { name, description, currentLevel, currentXp, targetXpForNextLevel } = validation.data;

  try {
    const newSkill = await prisma.skill.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        currentLevel: currentLevel || 1,
        currentXp: currentXp || 0,
        targetXpForNextLevel: targetXpForNextLevel || calculateTargetXpForLevel(currentLevel || 1),
        // Initialize decay fields
        decayEnabled: false,
        decayRate: null,
        decayIntervalDays: null,
        lastDecayCheck: null,
        // colorCode can be set here or updated later based on logic
      },
    });
    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    // Consider more specific error codes, e.g., if unique constraints fail
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
