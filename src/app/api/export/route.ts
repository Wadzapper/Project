// src/app/api/export/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const type = searchParams.get('type') as 'skills' | 'quests' | 'habits' | 'all' | null;
  const format = searchParams.get('format') as 'json' | 'csv' | null;

  if (!userId) {
    return NextResponse.json({ message: 'Missing required query parameter: userId' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ message: 'Missing required query parameter: type (skills, quests, habits, all)' }, { status: 400 });
  }
  if (!format) {
    return NextResponse.json({ message: 'Missing required query parameter: format (json, csv)' }, { status: 400 });
  }
  if (!['skills', 'quests', 'habits', 'all'].includes(type)) {
    return NextResponse.json({ message: 'Invalid type parameter. Must be one of: skills, quests, habits, all' }, { status: 400 });
  }
  if (!['json', 'csv'].includes(format)) {
    return NextResponse.json({ message: 'Invalid format parameter. Must be json or csv' }, { status: 400 });
  }

  try {
    let data: any;
    let fileName = `${userId}_export_${type}`;

    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!user) {
        return NextResponse.json({ message: `User with ID ${userId} not found.`}, { status: 404 });
    }

    if (type === 'skills' || type === 'all') {
      const skills = await prisma.skill.findMany({
        where: { userId },
        include: { skillTree: { select: { name: true } } } // Example of including related data
      });
      if (type === 'skills') data = skills;
      else data = { ...(data || {}), skills };
    }

    if (type === 'quests' || type === 'all') {
      const quests = await prisma.quest.findMany({
        where: { userId },
        include: {
            parentQuest: { select: { title: true }},
            relatedSkills: { select: { name: true }}
        }
      });
      if (type === 'quests') data = quests;
      else data = { ...(data || {}), quests };
    }

    if (type === 'habits' || type === 'all') {
      const habits = await prisma.habit.findMany({
        where: { userId },
        include: { history: { orderBy: { date: 'desc' }} }
      });
      if (type === 'habits') data = habits;
      else data = { ...(data || {}), habits };
    }

    // If type is 'all', data is already an object with keys skills, quests, habits.
    // If type is specific, data holds the array for that type.

    if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0) ) {
        return NextResponse.json({ message: 'No data found for the specified type and user.' }, { status: 404 });
    }


    if (format === 'json') {
      fileName += '.json';
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } else if (format === 'csv') {
      fileName += '.csv';
      let csv;
      const json2csvParser = new Parser();

      if (type === 'all') {
        // For 'all', CSV export might be tricky as it contains multiple arrays.
        // Option 1: Create a zip of multiple CSVs (complex for this phase)
        // Option 2: Flatten or pick one. For now, let's return a message or try to flatten skills.
        // Returning a single CSV for 'all' is non-trivial. We'll just export skills if 'all' and CSV.
        // A better approach would be separate CSVs per type or a ZIP.
        if(data.skills && data.skills.length > 0) {
            csv = json2csvParser.parse(data.skills.map((s: any) => ({...s, skillTreeName: s.skillTree?.name})));
            fileName = `${userId}_export_all_skills_partial.csv`; // Indicate it's partial
        } else if (data.quests && data.quests.length > 0) {
            csv = json2csvParser.parse(data.quests.map((q: any) => ({...q, parentQuestTitle: q.parentQuest?.title, relatedSkillNames: q.relatedSkills?.map((rs:any) => rs.name).join(', ') })));
            fileName = `${userId}_export_all_quests_partial.csv`;
        } else if (data.habits && data.habits.length > 0) {
            // Flattening habits with history is also complex for single CSV.
            // For simplicity, export habits without history for 'all' type CSV.
            csv = json2csvParser.parse(data.habits.map((h:any) => { const {history, ...habitData} = h; return habitData; }));
            fileName = `${userId}_export_all_habits_partial.csv`;
        } else {
            return NextResponse.json({ message: "CSV export for 'all' type is complex. Try exporting a specific type or JSON format." }, { status: 400 });
        }
      } else if (type === 'skills' && Array.isArray(data)) {
        csv = json2csvParser.parse(data.map((s: any) => ({...s, skillTreeName: s.skillTree?.name})));
      } else if (type === 'quests' && Array.isArray(data)) {
        csv = json2csvParser.parse(data.map((q: any) => ({...q, parentQuestTitle: q.parentQuest?.title, relatedSkillNames: q.relatedSkills?.map((rs:any) => rs.name).join(', ') })));
      } else if (type === 'habits' && Array.isArray(data)) {
        // For specific habit export, we might want to flatten history or provide only main habit data
        // For now, let's provide main habit data. A more detailed export might be needed.
         csv = json2csvParser.parse(data.map((h:any) => { const {history, ...habitData} = h; return habitData; }));
      } else {
         return NextResponse.json({ message: 'Data type not suitable for CSV export or no data.' }, { status: 400 });
      }

      if (!csv) {
        return NextResponse.json({ message: 'Could not generate CSV data.' }, { status: 500 });
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    // Should not reach here due to validation
    return NextResponse.json({ message: 'Invalid format specified.' }, { status: 400 });

  } catch (error) {
    console.error('Error exporting data:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error during export', error: error.message }, { status: 500 });
    }
    // Log unexpected errors
    console.error("Unexpected error in /api/export:", error);
    return NextResponse.json({ message: 'Internal server error during export' }, { status: 500 });
  }
}
