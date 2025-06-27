import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Habit, HabitLog, Skill, User } from '@prisma/client'; // Import relevant types

// Helper to convert JSON to CSV
function convertToCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) {
    return '';
  }
  const effectiveHeaders = headers || Object.keys(data[0]);
  const csvRows = [
    effectiveHeaders.join(','), // Header row
    ...data.map(row =>
      effectiveHeaders
        .map(header => JSON.stringify(row[header] === null || row[header] === undefined ? '' : row[header]))
        .join(',')
    ),
  ];
  return csvRows.join('\n');
}


export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json'; // Default to json

  try {
    if (format === 'json') {
      // JSON Export: Draft - User profile, habits, and skills
      const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true, personalPhilosophy: true }
      });
      const habits = await prisma.habit.findMany({
        where: { userId },
        include: { logs: { orderBy: { date: 'desc' }, take: 10 } }, // Include recent 10 logs per habit
        orderBy: { createdAt: 'desc' },
        take: 5 // Limit to 5 habits for draft
      });
      const skills = await prisma.skill.findMany({
        where: { userId },
        include: { progressLogs: { orderBy: { timestamp: 'desc' }, take: 10 } }, // Include recent 10 logs per skill
        orderBy: { createdAt: 'desc' },
        take: 5 // Limit to 5 skills for draft
      });

      const jsonData = {
        exportDate: new Date().toISOString(),
        userProfile,
        habits,
        skills,
        // Add other data sections as needed (quests, journal, fitness etc.)
      };
      return NextResponse.json(jsonData, {
        headers: {
          'Content-Disposition': `attachment; filename="user_data_export_${userId}.json"`,
        },
      });

    } else if (format === 'csv') {
      // CSV Export: Draft - Habit Logs
      const habitLogs = await prisma.habitLog.findMany({
        where: { userId },
        include: { habit: { select: { name: true, type: true, goalType: true } } },
        orderBy: { date: 'desc' },
      });

      if (habitLogs.length === 0) {
        return new NextResponse("No habit logs to export.", { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      const csvData = habitLogs.map(log => ({
        Date: log.date.toISOString().split('T')[0],
        HabitName: log.habit.name,
        HabitType: log.habit.type,
        GoalType: log.habit.goalType,
        LoggedStatus: log.isSuccess === true ? 'Success' : (log.isSuccess === false ? 'Failure' : 'Neutral/Skipped'),
        Notes: log.note || '',
        Count: log.count,
      }));

      const csvHeaders = ['Date', 'HabitName', 'HabitType', 'GoalType', 'LoggedStatus', 'Notes', 'Count'];
      const csvString = convertToCSV(csvData, csvHeaders);

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="habit_logs_export_${userId}.csv"`,
        },
      });

    } else {
      return NextResponse.json({ error: 'Invalid format specified. Use "json" or "csv".' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error generating data export:', error);
    return NextResponse.json({ error: 'Failed to generate data export' }, { status: 500 });
  }
}
