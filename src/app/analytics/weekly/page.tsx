// Summary: Page for displaying weekly activity analytics for habits and quests.
// TODO: Enhance chart tooltips and styling.
// TODO: Consider more sophisticated week navigation if more than 3 weeks are needed.
// TODO: Add specific error state display if data for a particular week is missing but API call was overall ok.

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts'; // Added Cell
import { ArrowLeft, CalendarRange, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast'; // Re-add toast import

interface WeekData {
  weekStart: string; // YYYY-MM-DD, Monday of that week
  counts: number[]; // 7 numbers, Mon-Sun
}
interface WeeklyAnalyticsData {
  habits: WeekData[];
  quests: WeekData[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyAnalyticsPage = () => {
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<WeeklyAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0); // 0: Current, 1: Last, 2: Week Before Last

  useEffect(() => {
    const fetchWeeklyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/analytics/weekly');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch weekly analytics data.');
        }
        const data: WeeklyAnalyticsData = await response.json();
        // API returns sorted (most recent first), so index 0 is current week
        setAnalyticsData(data);
        setSelectedWeekIndex(0); // Default to current week
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWeeklyData();
  }, []);

  const selectedHabitWeekData = analyticsData?.habits[selectedWeekIndex];
  const selectedQuestWeekData = analyticsData?.quests[selectedWeekIndex];

  const chartData = WEEKDAYS.map((day, index) => ({
    name: day,
    Habits: selectedHabitWeekData?.counts[index] || 0,
    Quests: selectedQuestWeekData?.counts[index] || 0,
    total: (selectedHabitWeekData?.counts[index] || 0) + (selectedQuestWeekData?.counts[index] || 0),
  }));

  // Find the day with maximum total activity for highlighting
  const maxActivityValue = Math.max(...chartData.map(d => d.total), 0);
  // To avoid highlighting if all are 0
  const isAnyActivity = maxActivityValue > 0;


  const getWeekDisplayName = (weekStartISO: string | undefined, index: number): string => {
    if (!weekStartISO) return `Week ${index + 1}`;
    if (index === 0) return `Current Week (Starts ${format(parseISO(weekStartISO), 'MMM d')})`;
    if (index === 1) return `Last Week (Starts ${format(parseISO(weekStartISO), 'MMM d')})`;
    return `Week of ${format(parseISO(weekStartISO), 'MMM d')}`;
  };

  if (isLoading) return <div className="container mx-auto p-6 text-center flex items-center justify-center h-[300px]"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading weekly analytics...</div>;
  if (error) return <div className="container mx-auto p-6 text-center text-red-500">Error: {error}</div>;
  if (!analyticsData || analyticsData.habits.length === 0) return <div className="container mx-auto p-6 text-center">No weekly analytics data available.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-2 sm:mb-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left flex-grow sm:flex-none">Weekly Activity</h1>
        <div className="w-[100px] sm:w-auto"> {/* Placeholder for potential future controls */} </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
                <CardTitle className="text-xl flex items-center">
                    <CalendarRange className="mr-2 h-5 w-5 text-primary"/>
                    Completions per Weekday
                </CardTitle>
                <CardDescription>
                    Displaying: {getWeekDisplayName(analyticsData.habits[selectedWeekIndex]?.weekStart, selectedWeekIndex)}
                </CardDescription>
            </div>
            <div className="flex space-x-2 mt-2 sm:mt-0">
              {analyticsData.habits.map((_, index) => (
                <Button
                  key={index}
                  variant={selectedWeekIndex === index ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWeekIndex(index)}
                >
                  {index === 0 ? 'This Week' : index === 1 ? 'Last Week' : `Week ${analyticsData.habits.length - index}`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[350px] sm:h-[400px] pt-6">
          {chartData.some(d => d.Habits > 0 || d.Quests > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Bar dataKey="Habits" stackId="a" name="Habit Completions" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-habits-${index}`} fill={isAnyActivity && entry.total === maxActivityValue ? '#c084fc' : '#8884d8'} />
                        // Highlight with purple if it's a max day, else default habit color
                    ))}
                </Bar>
                <Bar dataKey="Quests" stackId="a" name="Quest Completions" radius={[4, 4, 0, 0]}>
                     {chartData.map((entry, index) => (
                        <Cell key={`cell-quests-${index}`} fill={isAnyActivity && entry.total === maxActivityValue ? '#a78bfa' : '#82ca9d'} />
                        // Slightly different purple or adjust quest color for max day
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                No activity recorded for {getWeekDisplayName(analyticsData.habits[selectedWeekIndex]?.weekStart, selectedWeekIndex)}.
            </div>
          )}
        </CardContent>
      </Card>
       {/* TODO: Add optional line overlay to show trend if more historical data becomes available */}
    </div>
  );
};

export default WeeklyAnalyticsPage;
