// src/app/api/skills/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, Skill as PrismaSkill } from '@prisma/client'; // Import PrismaSkill
import { calculateSkillDecay, SkillForDecay } from '@/lib/skillUtils'; // Assuming @/ is configured for src/

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/skills/[id] - Fetch a single skill by ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const skillFromDb = await prisma.skill.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        skillTree: { select: { id: true, name: true } },
        // Include other details like dependencies, resources if needed for a detail view
      },
    });

    if (!skillFromDb) {
      return NextResponse.json({ message: 'Skill not found' }, { status: 404 });
    }

    // Ensure all date fields are Date objects before passing to calculateSkillDecay
    const skillForDecayCalc: SkillForDecay = {
      ...skillFromDb,
      createdAt: new Date(skillFromDb.createdAt),
      updatedAt: new Date(skillFromDb.updatedAt),
      lastDecay: skillFromDb.lastDecay ? new Date(skillFromDb.lastDecay) : null,
    };
    const decayResult = calculateSkillDecay(skillForDecayCalc);

    return NextResponse.json({
      ...skillFromDb,
      effectiveXp: decayResult.effectiveXp,
      effectiveLevel: decayResult.effectiveLevel,
    });
  } catch (error) {
    console.error(`Error fetching skill ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/skills/[id] - Update specific skill fields, including decay settings
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
        name, description, xp, level, maxLevel, category, tags,
        decayEnabled, decayRate, decayIntervalDays, skillTreeId
        // Not allowing direct update of lastDecay via PATCH data, it's managed internally.
    } = body;

    const currentSkill = await prisma.skill.findUnique({ where: { id } });
    if (!currentSkill) {
      return NextResponse.json({ message: 'Skill not found' }, { status: 404 });
    }

    const updateData: Prisma.SkillUpdateInput = {};

    // Standard field updates
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (xp !== undefined) updateData.xp = xp;
    if (level !== undefined) updateData.level = level;
    if (maxLevel !== undefined) updateData.maxLevel = maxLevel;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (skillTreeId !== undefined) {
        if (skillTreeId === null) {
            updateData.skillTree = { disconnect: true };
        } else {
            const skillTree = await prisma.skillTree.findUnique({where: {id: skillTreeId}});
            if(!skillTree || skillTree.userId !== currentSkill.userId){
                return NextResponse.json({ message: 'Invalid skillTreeId or skillTree does not belong to the user.' }, { status: 400 });
            }
            updateData.skillTree = { connect: { id: skillTreeId } };
        }
    }

    // Decay settings updates
    let decaySettingsChanged = false;
    if (decayEnabled !== undefined && decayEnabled !== currentSkill.decayEnabled) {
      updateData.decayEnabled = decayEnabled;
      decaySettingsChanged = true;
    }
    if (decayRate !== undefined && decayRate !== currentSkill.decayRate) {
      updateData.decayRate = decayRate;
      decaySettingsChanged = true;
    }
    if (decayIntervalDays !== undefined && decayIntervalDays !== currentSkill.decayIntervalDays) {
      updateData.decayIntervalDays = decayIntervalDays;
      decaySettingsChanged = true;
    }

    // If decay is enabled (either now or was already) AND settings changed,
    // or if it's just being enabled, reset lastDecay timestamp.
    const isNowEnabled = updateData.decayEnabled === true;
    const wasPreviouslyEnabled = currentSkill.decayEnabled === true;

    if ((isNowEnabled && decaySettingsChanged) || (isNowEnabled && !wasPreviouslyEnabled)) {
      updateData.lastDecay = new Date(); // Reset lastDecay to now
    }
    // If decayEnabled is explicitly set to false, we leave lastDecay as is (historical).
    // If decayEnabled remains true and other decay params (rate, interval) are changed, lastDecay is reset.

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(currentSkill, { status: 200 }); // No changes provided
    }

    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        skillTree: { select: { id: true, name: true } },
      },
    });

    // Recalculate effective values for the response
    const skillForDecayCalc: SkillForDecay = {
      ...updatedSkill,
      createdAt: new Date(updatedSkill.createdAt),
      updatedAt: new Date(updatedSkill.updatedAt),
      lastDecay: updatedSkill.lastDecay ? new Date(updatedSkill.lastDecay) : null,
    };
    const decayResult = calculateSkillDecay(skillForDecayCalc);

    return NextResponse.json({
      ...updatedSkill,
      effectiveXp: decayResult.effectiveXp,
      effectiveLevel: decayResult.effectiveLevel,
    });

  } catch (error) {
    console.error(`Error PATCHING skill ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Skill not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/skills/[id] - Update a skill by ID
// Phase 2.1 specifies PATCH for decay fields. We'll use PUT for general updates here.
// Can be refactored to PATCH for specific field updates later.
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    // Destructure all updatable fields from Skill model
    const {
      name,
      description,
      xp,
      level,
      maxLevel,
      category,
      tags,
      decayRate,
      decayIntervalDays,
      lastDecay,
      decayEnabled,
      skillTreeId,
      // userId should generally not be updatable this way, ownership change is a separate process.
    } = body;

    const updateData: Prisma.SkillUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (xp !== undefined) updateData.xp = xp;
    if (level !== undefined) updateData.level = level;
    if (maxLevel !== undefined) updateData.maxLevel = maxLevel;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (decayRate !== undefined) updateData.decayRate = decayRate;
    if (decayIntervalDays !== undefined) updateData.decayIntervalDays = decayIntervalDays;
    if (lastDecay !== undefined) updateData.lastDecay = new Date(lastDecay);
    if (decayEnabled !== undefined) updateData.decayEnabled = decayEnabled;

    if (skillTreeId !== undefined) {
        if (skillTreeId === null) { // Allow unsetting skillTreeId
            updateData.skillTree = { disconnect: true };
        } else {
            // Optional: Validate skillTreeId exists and belongs to the same user as the skill
            const skill = await prisma.skill.findUnique({ where: {id}});
            if(skill) {
                const skillTree = await prisma.skillTree.findUnique({where: {id: skillTreeId}});
                if(!skillTree || skillTree.userId !== skill.userId){
                    return NextResponse.json({ message: 'Invalid skillTreeId or skillTree does not belong to the user.' }, { status: 400 });
                }
                updateData.skillTree = { connect: { id: skillTreeId } };
            } else {
                 return NextResponse.json({ message: 'Skill not found for skillTree validation.' }, { status: 404 });
            }
        }
    }


    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
        skillTree: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updatedSkill);
  } catch (error) {
    console.error(`Error updating skill ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Skill not found' }, { status: 404 });
      }
      // Add other specific error codes if needed, e.g., P2002 for unique constraints if any apply
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/skills/[id] - Delete a skill by ID
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    // Optional: Check if the skill is a prerequisite for other skills before deleting
    // const dependentSkills = await prisma.skillDependency.count({ where: { prerequisiteId: id } });
    // if (dependentSkills > 0) {
    //   return NextResponse.json({ message: 'Cannot delete skill. It is a prerequisite for other skills.' }, { status: 400 });
    // }

    await prisma.skill.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Skill deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting skill ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Skill not found' }, { status: 404 });
      }
      // P2003: Foreign key constraint failed on the field: `SkillDependency_prerequisiteId_fkey (index)`
      // This means the skill is a prerequisite and cannot be deleted.
      if (error.code === 'P2003' && error.meta?.field_name?.toString().includes('SkillDependency_prerequisiteId')) {
        return NextResponse.json({ message: 'Cannot delete skill. It is a prerequisite for other skills. Please remove dependencies first.' }, { status: 400 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
