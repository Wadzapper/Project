'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, BarChart2, Activity, Smile, Zap, ShieldCheck, Loader2 } from 'lucide-react'; // Added Loader2
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, CartesianGrid } from 'recharts'; // Added CartesianGrid, Legend, Cell
import { QuestType } from '@prisma/client';

// Define the structure of the overview data expected from the API
interface SkillOverview {
  totalXp: number;
  count: number;
}
interface QuestCompletionStatsByType {
  totalQuests: number;
  completedQuests: number;
  rate: number;
}
interface QuestOverview {
  byType: { [key in QuestType]?: QuestCompletionStatsByType }; // Key should be actual QuestType values
  overall: {
    total: number;
    completed: number;
    rate: number;
  };
}
interface FitnessOverview {
  totalDurationLastNDaysMinutes: number;
  workoutCountLastNDays: number;
  periodDays: number;
}
interface WellbeingOverview {
  averageMoodLastNDays: number | null;
  moodRatingsCountLastNDays: number;
  periodDays: number;
}
interface AnalyticsOverviewData {
  skills: SkillOverview;
  quests: QuestOverview;
  fitness: FitnessOverview;
  wellbeing: WellbeingOverview;
}

// Function to get themed colors for quest types
const getQuestTypeColor = (type: QuestType): string => {
  // Ensure these map to actual values in your QuestType enum
  const colorMap: { [key in QuestType]: string } = {
    [QuestType.MANUAL]: 'var(--color-info)',
    [QuestType.SKILL_XP]: 'var(--color-accent-primary)',
    [QuestType.STREAK]: 'var(--color-success)',
    [QuestType.DATE_TARGET]: 'var(--color-warning)',
    // Add mappings for any other QuestType enum values you have
    // For example, if you had DAILY_TASK, WEEKLY_TARGET etc. map them here
    // DAILY_TASK: 'var(--color-some-other-theme-color)',
  };
  return colorMap[type] || 'var(--color-text-secondary)'; // Fallback
};


export default function AnalyticsDashboardPage() {
  const [overviewData, setOverviewData] = useState<AnalyticsOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/analytics/overview');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch overview data.');
        }
        const data: AnalyticsOverviewData = await response.json();
        setOverviewData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExportData = () => {
    window.location.href = '/api/export?type=all&format=json';
  };

  const questChartData = overviewData?.quests.byType
    ? Object.entries(overviewData.quests.byType)
        .filter(([type, data]) => data && data.totalQuests > 0 && QuestType[type as QuestType]) // Ensure type is valid enum key
        .map(([type, data]) => ({
            name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            CompletionRate: data.rate * 100,
            Completed: data.completedQuests,
            Total: data.totalQuests,
            fill: getQuestTypeColor(type as QuestType),
      }))
    : [];

  const tooltipStyle = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-primary)',
    color: 'var(--color-text-primary)',
    borderRadius: 'var(--radius)'
  };
  const tickFill = 'var(--color-text-secondary)';
  const gridStroke = 'var(--color-border-secondary)';
  const legendStyle = { color: 'var(--color-text-secondary)', fontSize: '12px' };


  if (isLoading) return <div className="container mx-auto p-6 text-center text-text-secondary flex items-center justify-center h-screen"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading dashboard data...</div>;
  if (error) return <div className="container mx-auto p-6 text-center text-red-500 dark:text-red-400">Error: {error}</div>;
  if (!overviewData) return <div className="container mx-auto p-6 text-center text-text-secondary">No overview data available.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-text-primary">Analytics Overview</h1>
        <Button onClick={handleExportData} variant="outline">
          <Download className="mr-2 h-4 w-4 text-text-secondary" /> Download Full Report (JSON)
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-primary">Total Skill XP</CardTitle>
            <Zap className="h-4 w-4 text-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{overviewData.skills.totalXp.toLocaleString()}</div>
            <p className="text-xs text-text-secondary">Across {overviewData.skills.count} skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-primary">Overall Quest Completion</CardTitle>
            <ShieldCheck className="h-4 w-4 text-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{(overviewData.quests.overall.rate * 100).toFixed(0)}%</div>
            <p className="text-xs text-text-secondary">
              {overviewData.quests.overall.completed} / {overviewData.quests.overall.total} quests
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-primary">Avg. Mood (Last {overviewData.wellbeing.periodDays}d)</CardTitle>
            <Smile className="h-4 w-4 text-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {overviewData.wellbeing.averageMoodLastNDays !== null ? overviewData.wellbeing.averageMoodLastNDays.toFixed(1) : 'N/A'}
            </div>
            <p className="text-xs text-text-secondary">
              Based on {overviewData.wellbeing.moodRatingsCountLastNDays} ratings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-primary">Workouts (Last {overviewData.fitness.periodDays}d)</CardTitle>
            <Activity className="h-4 w-4 text-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{overviewData.fitness.workoutCountLastNDays}</div>
            <p className="text-xs text-text-secondary">
              {Math.floor(overviewData.fitness.totalDurationLastNDaysMinutes / 60)}h {overviewData.fitness.totalDurationLastNDaysMinutes % 60}m total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-text-primary">Quest Completion Rate by Type</CardTitle>
            <CardDescription className="text-text-secondary">Percentage of completed quests for each type.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[350px]">
            {questChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={questChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.3}/>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} stroke={gridStroke} tick={{ fill: tickFill }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, dy: 2, fill: tickFill }} interval={0} stroke={gridStroke}/>
                  <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--color-accent-primary)', fillOpacity: 0.1}} formatter={(value: number) => [`${value.toFixed(0)}%`, "Completion Rate"]} />
                  <Bar dataKey="CompletionRate" name="Completion Rate" barSize={20} radius={[4,4,0,0]}>
                     {questChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-text-secondary text-center pt-10">No quest data available for this chart.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="text-lg text-text-primary">Additional Insights (Placeholder)</CardTitle>
                <CardDescription className="text-text-secondary">More charts coming soon (e.g., mood trends, XP progression).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
                <BarChart2 className="w-16 h-16 text-text-secondary opacity-50"/>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
