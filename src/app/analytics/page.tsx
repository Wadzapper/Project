'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, BarChart2, Activity, Smile, Zap, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { QuestType } from '@prisma/client'; // For typing quest stats

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
  byType: { [key in QuestType]?: QuestCompletionStatsByType };
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

const QUEST_TYPE_COLORS: { [key in QuestType]: string } = {
    DAILY_TASK: '#8884d8', // Purple
    WEEKLY_TARGET: '#82ca9d', // Green
    ONE_TIME: '#ffc658', // Yellow
    DEADLINE: '#ff8042', // Orange
    SKILL_MASTERY: '#8dd1e1', // Teal
    // Add other quest types if they exist in your enum
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
    // Trigger download
    window.location.href = '/api/export?type=all&format=json';
  };

  const questChartData = overviewData?.quests.byType
    ? Object.entries(overviewData.quests.byType)
        .filter(([type, data]) => data && data.totalQuests > 0) // Filter out types with no quests
        .map(([type, data]) => ({
            name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Format name
            CompletionRate: data.rate * 100, // As percentage
            Completed: data.completedQuests,
            Total: data.totalQuests,
            fill: QUEST_TYPE_COLORS[type as QuestType] || '#cccccc', // Fallback color
      }))
    : [];


  if (isLoading) return <div className="container mx-auto p-6 text-center">Loading dashboard data...</div>;
  if (error) return <div className="container mx-auto p-6 text-center text-red-500">Error: {error}</div>;
  if (!overviewData) return <div className="container mx-auto p-6 text-center">No overview data available.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Analytics Overview</h1>
        <Button onClick={handleExportData} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Download Full Report (JSON)
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skill XP</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overviewData.skills.totalXp.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across {overviewData.skills.count} skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Quest Completion</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(overviewData.quests.overall.rate * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {overviewData.quests.overall.completed} / {overviewData.quests.overall.total} quests
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Mood (Last {overviewData.wellbeing.periodDays}d)</CardTitle>
            <Smile className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.wellbeing.averageMoodLastNDays !== null ? overviewData.wellbeing.averageMoodLastNDays.toFixed(1) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {overviewData.wellbeing.moodRatingsCountLastNDays} ratings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workouts (Last {overviewData.fitness.periodDays}d)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overviewData.fitness.workoutCountLastNDays}</div>
            <p className="text-xs text-muted-foreground">
              {Math.floor(overviewData.fitness.totalDurationLastNDaysMinutes / 60)}h {overviewData.fitness.totalDurationLastNDaysMinutes % 60}m total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Quest Completion Rate by Type</CardTitle>
            <CardDescription>Percentage of completed quests for each type.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[350px]">
            {questChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={questChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3}/>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, dy: 2}} interval={0}/>
                  <Tooltip formatter={(value: number) => [`${value.toFixed(0)}%`, "Completion Rate"]} />
                  {/* <Legend /> */}
                  <Bar dataKey="CompletionRate" name="Completion Rate" barSize={20}>
                     {questChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center pt-10">No quest data available for this chart.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="text-lg">Additional Insights (Placeholder)</CardTitle>
                <CardDescription>More charts coming soon (e.g., mood trends, XP progression).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
                <BarChart2 className="w-16 h-16 text-muted-foreground opacity-50"/>
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
