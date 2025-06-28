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
  const requestedFormat = searchParams.get('format')?.toLowerCase() || 'json';
  const requestedType = searchParams.get('type')?.toLowerCase() || (requestedFormat === 'json' ? 'all' : null);

  if (requestedFormat !== 'json' && requestedFormat !== 'csv') {
    return NextResponse.json({ error: 'Invalid format specified. Use "json" or "csv".' }, { status: 400 });
  }

  if (!requestedType) {
    return NextResponse.json({ error: 'Parameter "type" is required for CSV export or if not defaulting to "all" for JSON.' }, { status: 400 });
  }

  if (requestedFormat === 'csv' && requestedType === 'all') {
    return NextResponse.json({ error: '"all" type is not supported for CSV export due to data complexity. Please specify a data type (e.g., habits, skills).' }, { status: 400 });
  }

  try {
    let dataToExport: any;
    let filename = `user_export_${userId}_${requestedType}`;
    let csvHeaders: string[] | undefined;

    const userProfileData = async () => prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true, personalPhilosophy: true }
    });
    const skillsData = async () => prisma.skill.findMany({ where: { userId }, include: { skillProgressLogs: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    const skillTreesData = async () => prisma.skillTree.findMany({ where: { userId }, include: { nodes: { include: { skill: {select: {name: true}} } } } , orderBy: { createdAt: 'desc' }});
    const questsData = async () => prisma.quest.findMany({ where: { userId }, include: { dependencies: true, logs: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    const achievementsData = async () => prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { unlockedAt: 'desc' } });
    const habitsData = async () => prisma.habit.findMany({ where: { userId }, include: { logs: { orderBy: { date: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    const journalEntriesData = async () => prisma.journalEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } });
    const dailyRatingsData = async () => prisma.dailyRating.findMany({ where: { userId }, orderBy: { date: 'desc' } });
    const workoutSessionsData = async () => prisma.workoutSession.findMany({ where: { userId }, include: { exerciseLogs: { include: { sets: true } } }, orderBy: { date: 'desc' } });
    const bodyMetricsData = async () => prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: 'desc' } });
    const sleepLogsData = async () => prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' } }); // Corrected to 'date' if 'sleepTime' is not the intended sort key for logs generally


    if (requestedFormat === 'json') {
      let jsonData: any = { exportDate: new Date().toISOString(), userId };
      if (requestedType === 'all') {
        const [user, skills, skillTrees, quests, achievements, habits, journalEntries, dailyRatings, workoutSessions, bodyMetrics, sleepLogs] = await Promise.all([
          userProfileData(), skillsData(), skillTreesData(), questsData(), achievementsData(), habitsData(), journalEntriesData(), dailyRatingsData(), workoutSessionsData(), bodyMetricsData(), sleepLogsData()
        ]);
        jsonData = { ...jsonData, userProfile: user, skills, skillTrees, quests, achievements, habits, journalEntries, dailyRatings, fitness: { workoutSessions, bodyMetrics, sleepLogs } };
      } else if (requestedType === 'skills') jsonData.skills = await skillsData();
      else if (requestedType === 'quests') jsonData.quests = await questsData();
      else if (requestedType === 'habits') jsonData.habits = await habitsData();
      else if (requestedType === 'journalentries') jsonData.journalEntries = await journalEntriesData();
      else if (requestedType === 'dailylogs') jsonData.dailyRatings = await dailyRatingsData();
      else if (requestedType === 'fitnesssessions') jsonData.workoutSessions = await workoutSessionsData();
      else if (requestedType === 'bodymetrics') jsonData.bodyMetrics = await bodyMetricsData();
      else if (requestedType === 'sleeplogs') jsonData.sleepLogs = await sleepLogsData();
      else return NextResponse.json({ error: `Unsupported data type "${requestedType}" for JSON export.` }, { status: 400 });

      dataToExport = jsonData;
      filename += '.json';

      return NextResponse.json(dataToExport, {
        headers: { 'Content-Disposition': `attachment; filename="${filename}"` },
      });

    } else if (requestedFormat === 'csv') {
      let rawDataArray: any[] = [];
      if (requestedType === 'skills') {
        rawDataArray = (await skillsData()).map(s => ({...s, progressLogs: undefined})); // Exclude nested logs for simple CSV
        csvHeaders = ['id', 'name', 'description', 'currentLevel', 'currentXp', 'targetXpForNextLevel', 'createdAt', 'decayEnabled', 'decayRate', 'decayIntervalDays', 'lastDecayCheck'];
      } else if (requestedType === 'quests') {
        rawDataArray = (await questsData()).map(q => ({...q, dependencies: undefined, logs: undefined, name: q.name})); // Changed q.title to q.name
        csvHeaders = ['id', 'name', 'description', 'type', 'status', 'createdAt', 'completedAt', 'failedAt']; // Removed xpReward, deadline as they are not on Quest model
      } else if (requestedType === 'habits') {
        rawDataArray = (await habitsData()).map(h => ({...h, logs: undefined, tags: h.tags.join('|')}));
        csvHeaders = ['id', 'name', 'description', 'type', 'goalType', 'frequency', 'periodInDays', 'tags', 'archived', 'createdAt', 'currentStreak', 'longestStreak', 'successCount', 'totalLogCount', 'lastLoggedDate'];
      } else if (requestedType === 'habitlogs') {
         const logs = await prisma.habitLog.findMany({ where: { userId }, include: { habit: { select: { name: true, type: true, goalType: true } } }, orderBy: { date: 'desc' }});
         rawDataArray = logs.map(log => ({
            Date: log.date.toISOString().split('T')[0], HabitName: log.habit.name, HabitType: log.habit.type, GoalType: log.habit.goalType,
            LoggedStatus: log.isSuccess === true ? 'Success' : (log.isSuccess === false ? 'Failure' : 'Neutral/Skipped'), Notes: log.note || '', Count: log.count,
          }));
        csvHeaders = ['Date', 'HabitName', 'HabitType', 'GoalType', 'LoggedStatus', 'Notes', 'Count'];
      } else if (requestedType === 'journalentries') {
        rawDataArray = await journalEntriesData();
        csvHeaders = ['id', 'date', 'content', 'createdAt', 'updatedAt'];
      } else if (requestedType === 'dailylogs') {
        rawDataArray = await dailyRatingsData();
        csvHeaders = ['id', 'date', 'category', 'value', 'notes', 'createdAt'];
      } else if (requestedType === 'fitnesssessions') {
        rawDataArray = (await workoutSessionsData()).map(s => ({...s, exercises: undefined}));
        csvHeaders = ['id', 'name', 'startTime', 'durationMinutes', 'notes', 'mood', 'perceivedEffort'];
      } else if (requestedType === 'bodymetrics') {
        rawDataArray = await bodyMetricsData();
        csvHeaders = ['id', 'date', 'weightKg', 'bodyFatPercentage', 'notes'];
      } else if (requestedType === 'sleeplogs') {
        rawDataArray = await sleepLogsData();
        csvHeaders = ['id', 'sleepTime', 'wakeTime', 'qualityRating', 'notes', 'durationHours'];
      }
       else {
        return NextResponse.json({ error: `Unsupported data type "${requestedType}" for CSV export.` }, { status: 400 });
      }

      if (rawDataArray.length === 0) {
        return new NextResponse(`No data found for type "${requestedType}" to export as CSV.`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      const csvString = convertToCSV(rawDataArray, csvHeaders);
      filename += '.csv';
      return new NextResponse(csvString, {
        status: 200,
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${filename}"` },
      });
    }

  } catch (error) {
    console.error('Error generating data export:', error);
    return NextResponse.json({ error: 'Failed to generate data export' }, { status: 500 });
  }
}
