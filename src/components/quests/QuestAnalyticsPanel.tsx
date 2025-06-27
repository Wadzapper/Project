'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { QuestType, QuestStatus } from '@prisma/client'; // For QuestType enum
import { CheckSquare, ListChecks } from 'lucide-react';

// Expected structure from /api/quests/analytics
interface QuestCompletionRateStat {
  totalQuests: number;
  completedQuests: number;
  rate: number;
}
interface RecentCompletion {
  questId: string;
  questTitle: string;
  completedAt: string; // ISO date string
}
interface QuestAnalyticsData {
  completionRateByType: {
    [key in QuestType]?: QuestCompletionRateStat;
  };
  recentCompletions: RecentCompletion[];
}

// Colors for quest types - consistent with AnalyticsDashboardPage if possible
const QUEST_TYPE_CHART_COLORS: { [key in QuestType]: string } = {
    DAILY_TASK: '#8884d8',
    WEEKLY_TARGET: '#82ca9d',
    ONE_TIME: '#ffc658',
    DEADLINE: '#ff8042',
    SKILL_MASTERY: '#8dd1e1',
    // Ensure all your QuestTypes have a color
};

const QuestAnalyticsPanel: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<QuestAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/quests/analytics');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch quest analytics.');
        }
        const data: QuestAnalyticsData = await response.json();
        setAnalyticsData(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching quest analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestAnalytics();
  }, []);

  const completionRateChartData = analyticsData?.completionRateByType
    ? Object.entries(analyticsData.completionRateByType)
        .filter(([type, data]) => data && data.totalQuests > 0) // Only show types with quests
        .map(([type, data]) => ({
          name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          Rate: data.rate * 100, // As percentage
          Completed: data.completedQuests,
          Total: data.totalQuests,
          fill: QUEST_TYPE_CHART_COLORS[type as QuestType] || '#cccccc',
        }))
    : [];

  if (isLoading) return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading quest analytics...</CardContent></Card>;
  if (error) return <Card><CardContent className="p-6 text-center text-red-500">Error: {error}</CardContent></Card>;
  if (!analyticsData || (completionRateChartData.length === 0 && analyticsData.recentCompletions.length === 0)) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">No quest analytics data available.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {completionRateChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <BarChart className="mr-2 h-5 w-5 text-primary" /> Quest Completion Rates by Type
            </CardTitle>
            <CardDescription>Percentage of completed quests for each defined type.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionRateChartData} layout="vertical" margin={{ top: 5, right: 30, left: 25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} fontSize={10} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  formatter={(value: number, nameKey: string, props) => {
                    if (nameKey === 'Rate') return [`${value.toFixed(0)}% (${props.payload.Completed}/${props.payload.Total})`, "Completion"];
                    return [value, nameKey];
                  }}
                  cursor={{ fill: 'rgba(200,200,200,0.1)' }}
                />
                <Bar dataKey="Rate" barSize={20}>
                  {completionRateChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {analyticsData.recentCompletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <ListChecks className="mr-2 h-5 w-5 text-primary" /> Recently Completed Quests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analyticsData.recentCompletions.map(quest => (
                <li key={quest.questId} className="text-sm p-2 border-b border-border/50 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-card-foreground">{quest.questTitle}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(quest.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QuestAnalyticsPanel;
