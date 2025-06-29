// src/app/api/export/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { Parser } from 'json2csv';
import JSZip from 'jszip';

const prisma = new PrismaClient();

// Helper function to safely stringify potentially complex objects for CSV
const safeStringify = (obj: any): string => {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return 'Error serializing object';
  }
};


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ message: 'Request body must contain "userId".' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
      }
    });

    if (!user) {
      return NextResponse.json({ message: `User with ID ${userId} not found.` }, { status: 404 });
    }

    const json2csvParser = new Parser();
    const zip = new JSZip();
    const fileNamePrefix = `gamified_os_export_${userId}_${new Date().toISOString().split('T')[0]}`;

    // 1. User Data (User, UserProfile, UserPreferences)
    const { profile, preferences, ...userData } = user;
    const userProfileData = profile ? [{ ...profile, userId: user.id }] : [];
    const userPreferencesData = preferences ? [{ ...preferences, userId: user.id }] : [];

    zip.file("user.csv", json2csvParser.parse([userData]));
    if (userProfileData.length > 0) zip.file("user_profile.csv", json2csvParser.parse(userProfileData));
    if (userPreferencesData.length > 0) zip.file("user_preferences.csv", json2csvParser.parse(userPreferencesData));

    // 2. Skills
    const skills = await prisma.skill.findMany({ where: { userId }, include: { skillTree: {select: {name: true}} } });
    if (skills.length > 0) {
        const skillsCsv = skills.map(s => ({...s, skillTreeName: s.skillTree?.name, tags: s.tags.join(',')}));
        zip.file("skills.csv", json2csvParser.parse(skillsCsv));
    }

    // 3. SkillTrees
    const skillTrees = await prisma.skillTree.findMany({ where: { userId }, include: { _count: {select: {skills: true}}} });
     if (skillTrees.length > 0) {
        const skillTreesCsv = skillTrees.map(st => ({...st, nodes: safeStringify(st.nodes), skillsCount: st._count.skills}));
        zip.file("skill_trees.csv", json2csvParser.parse(skillTreesCsv));
    }

    // 4. Quests
    const quests = await prisma.quest.findMany({
        where: { userId },
        include: {
            parentQuest: {select: {title: true}},
            relatedSkills: {select: {name: true}},
            dependencies: {include: {dependsOn: {select: {title: true}}}},
            dependents: {include: {quest: {select: {title: true}}}},
        }
    });
    if (quests.length > 0) {
        const questsCsv = quests.map(q => ({
            ...q,
            parentQuestTitle: q.parentQuest?.title,
            relatedSkillNames: q.relatedSkills.map(s => s.name).join(','),
            tags: q.tags.join(','),
            dependenciesTitles: q.dependencies.map(d => d.dependsOn.title).join('; '),
            dependentsTitles: q.dependents.map(d => d.quest.title).join('; '),
        }));
        zip.file("quests.csv", json2csvParser.parse(questsCsv));
    }

    // Quest Dependencies (as a separate file for clarity if many-to-many becomes complex)
    // For now, included basic info in quests.csv

    // 5. Habits & HabitHistory
    const habits = await prisma.habit.findMany({ where: { userId } });
    if (habits.length > 0) zip.file("habits.csv", json2csvParser.parse(habits));

    const habitHistory = await prisma.habitHistory.findMany({ where: { habit: { userId } } });
    if (habitHistory.length > 0) zip.file("habit_history.csv", json2csvParser.parse(habitHistory));

    // 6. Paths & PathSteps
    const paths = await prisma.path.findMany({ where: { userId } });
    if (paths.length > 0) zip.file("paths.csv", json2csvParser.parse(paths));

    const pathSteps = await prisma.pathStep.findMany({
        where: { path: { userId } },
        include: {
            relatedSkill: {select: {name: true}},
            relatedQuest: {select: {title: true}},
        }
    });
    if (pathSteps.length > 0) {
        const pathStepsCsv = pathSteps.map(ps => ({
            ...ps,
            relatedSkillName: ps.relatedSkill?.name,
            relatedQuestTitle: ps.relatedQuest?.title,
        }));
        zip.file("path_steps.csv", json2csvParser.parse(pathStepsCsv));
    }

    // 7. MindMaps, MindMapNodes, MindMapEdges
    const mindMaps = await prisma.mindMap.findMany({ where: { userId } });
    if (mindMaps.length > 0) {
        const mindMapsCsv = mindMaps.map(mm => ({...mm, layout: safeStringify(mm.layout)}));
        zip.file("mind_maps.csv", json2csvParser.parse(mindMapsCsv));
    }

    const mindMapNodes = await prisma.mindMapNode.findMany({ where: { mindMap: { userId } } });
    if (mindMapNodes.length > 0) zip.file("mind_map_nodes.csv", json2csvParser.parse(mindMapNodes));

    const mindMapEdges = await prisma.mindMapEdge.findMany({ where: { mindMap: { userId } } });
    if (mindMapEdges.length > 0) zip.file("mind_map_edges.csv", json2csvParser.parse(mindMapEdges));

    // 8. UserPhilosophies
    const userPhilosophy = await prisma.userPhilosophy.findUnique({ where: { userId } });
    if (userPhilosophy) {
        const philosophyCsv = [{...userPhilosophy, coreValues: userPhilosophy.coreValues.join(','), quotes: safeStringify(userPhilosophy.quotes) }];
        zip.file("user_philosophy.csv", json2csvParser.parse(philosophyCsv));
    }

    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    const finalFileName = `${fileNamePrefix}.zip`;

    return new NextResponse(zipContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${finalFileName}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting user data:', error);
    // Ensure error is an instance of Error for type safety with message property
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error during export', error: errorMessage }, { status: 500 });
    }
    console.error("Unexpected error in POST /api/export:", error);
    return NextResponse.json({ message: 'Internal server error during export', error: errorMessage }, { status: 500 });
  }
}
