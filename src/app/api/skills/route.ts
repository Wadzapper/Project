// src/app/api/skills/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, Skill as PrismaSkill } from '@prisma/client'; // Import PrismaSkill
import { calculateSkillDecay, SkillForDecay } from '@/lib/skillUtils'; // Assuming @/ is configured for src/

const prisma = new PrismaClient();

// GET /api/skills - Fetch all skills (optionally filtered by userId)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    const skillsFromDb = await prisma.skill.findMany({
      where: userId ? { userId } : {},
      include: {
        user: { // Include basic user info, selecting only username
          select: { id: true, username: true }
        },
        skillTree: {
          select: { id: true, name: true }
        }
        // Add other relevant includes like category, tags if needed for list view
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const skillsWithEffectiveValues = skillsFromDb.map(skill => {
      // Ensure all date fields are Date objects before passing to calculateSkillDecay
      const skillForDecayCalc: SkillForDecay = {
        ...skill,
        createdAt: new Date(skill.createdAt),
        updatedAt: new Date(skill.updatedAt),
        lastDecay: skill.lastDecay ? new Date(skill.lastDecay) : null,
      };
      const decayResult = calculateSkillDecay(skillForDecayCalc);
      return {
        ...skill,
        effectiveXp: decayResult.effectiveXp,
        effectiveLevel: decayResult.effectiveLevel,
        // We don't persist changes from a GET request.
        // The 'needsDbUpdate' and 'lastDecayApplicable' from decayResult are for informational purposes here
        // or for a potential background update process, not applied directly on GET.
      };
    });

    return NextResponse.json(skillsWithEffectiveValues);
  } catch (error) {
    console.error('Error fetching skills:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Ensure all required fields are present, especially userId
    const { userId, name, description, category, tags, skillTreeId, decayRate, decayIntervalDays, decayEnabled, maxLevel } = body;

    if (!userId || !name) {
      return NextResponse.json({ message: 'Missing required fields: userId, name' }, { status: 400 });
    }

    // Validate if user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with id ${userId} not found.` }, { status: 404 });
    }

    if (skillTreeId) {
      const skillTreeExists = await prisma.skillTree.findUnique({ where: { id: skillTreeId } });
      if (!skillTreeExists) {
        return NextResponse.json({ message: `SkillTree with id ${skillTreeId} not found.` }, { status: 404 });
      }
      if (skillTreeExists.userId !== userId) {
        return NextResponse.json({ message: 'SkillTree does not belong to the specified user.' }, { status: 403 });
      }
    }

    const newSkill = await prisma.skill.create({
      data: {
        userId,
        name,
        description,
        category,
        tags,
        skillTreeId,
        decayRate,
        decayIntervalDays,
        decayEnabled,
        maxLevel,
        xp: 0, // Default values
        level: 1,
      },
      include: {
        user: { select: { id: true, username: true }},
        skillTree: { select: { id: true, name: true }}
      }
    });
    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: Handle unique constraint if skill name should be unique per user
      // if (error.code === 'P2002') {
      //   return NextResponse.json({ message: 'Skill name already exists for this user' }, { status: 409 });
      // }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
