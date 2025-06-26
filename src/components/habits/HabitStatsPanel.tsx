'use client';

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { HabitDisplay } from '@/app/habits/page'; // Path to HabitDisplay interface
import { HabitType, HabitGoalType } from '@prisma/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, parseISO, startOfDay, subDays, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';

// Data structure from GET /api/habits/[habitId]/analytics
interface AnalyticsDataPoint {
  date: string; // 'YYYY-MM-DD'
  logged: boolean;
  streak: number;
}

interface HabitStatsPanelProps {
  habitsInCurrentView: HabitDisplay[]; // For the dropdown selector
  activeFilterType: HabitType; // To pre-filter dropdown or show context title
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/80 backdrop-blur-sm p-2 border rounded shadow-lg text-sm">
        <p className="font-semibold">{`Date: ${label}`}</p>
        <p style={{ color: payload[0].stroke }}>{`Streak: ${payload[0].value}`}</p>
        <p>{`Logged: ${payload[0].payload.logged ? 'Yes' : 'No'}`}</p>
      </div>
    );
  }
  return null;
};


const HabitStatsPanel: React.FC<HabitStatsPanelProps> = ({ habitsInCurrentView, activeFilterType }) => {
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<number>(30); // Default to 30 days

  const availableHabitsForSelection = useMemo(() => {
    return habitsInCurrentView.filter(h => !h.archived && h.type === activeFilterType);
  }, [habitsInCurrentView, activeFilterType]);

  useEffect(() => {
    // Auto-select first habit if list changes or initially
    if (availableHabitsForSelection.length > 0 && !selectedHabitId) {
      setSelectedHabitId(availableHabitsForSelection[0].id);
    } else if (availableHabitsForSelection.length === 0) {
        setSelectedHabitId(null); // Clear selection if no habits match
    }
  }, [availableHabitsForSelection, selectedHabitId]);


  useEffect(() => {
    if (!selectedHabitId) {
      setAnalyticsData([]); // Clear data if no habit is selected
      return;
    }

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/habits/${selectedHabitId}/analytics?range=${analyticsRange}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch analytics for habit ${selectedHabitId}`);
        }
        const data: AnalyticsDataPoint[] = await response.json();
        // Ensure data is sorted by date for charts if API doesn't guarantee it (API should guarantee it)
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAnalyticsData(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching habit analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedHabitId, analyticsRange]);

  const selectedHabitDetails = useMemo(() => {
    return habitsInCurrentView.find(h => h.id === selectedHabitId);
  }, [selectedHabitId, habitsInCurrentView]);

  // Prepare data for Activity Grid (simplified heatmap)
  // It will show 'analyticsRange' number of days.
  // We need to create a grid of 'analyticsRange' cells.
  const activityGridData = useMemo(() => {
    if (!analyticsData.length) return [];

    // The analyticsData is already for the range, sorted by date.
    // We just need to format it for the grid.
    // For a 7-column grid, we might need to pad if it's not a multiple of 7.
    // Or, just display them sequentially.
    return analyticsData.map(day => ({
        date: day.date,
        dayOfMonth: format(parseISO(day.date), 'd'), // parseISO to convert string to Date
        logged: day.logged,
    }));
  }, [analyticsData]);


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <CardTitle className="text-lg sm:text-xl">
            Individual Habit Insights
            {selectedHabitDetails && <span className="text-primary ml-2">({selectedHabitDetails.name})</span>}
          </CardTitle>
          <div className="w-full sm:w-auto min-w-[200px]">
            <Select
              value={selectedHabitId || ''}
              onValueChange={(value) => setSelectedHabitId(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a habit..." />
              </SelectTrigger>
              <SelectContent>
                {availableHabitsForSelection.length > 0 ? (
                  availableHabitsForSelection.map(habit => (
                    <SelectItem key={habit.id} value={habit.id}>
                      {habit.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">No habits of type '{activeFilterType}' found.</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedHabitDetails && (
             <CardDescription>
                Displaying analytics for "{selectedHabitDetails.name}" (Type: {selectedHabitDetails.type}, Goal: {selectedHabitDetails.goalType}).
                Current Streak: {selectedHabitDetails.currentStreak}. Data for last {analyticsRange} days.
            </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedHabitId && (
          <div className="text-center py-10 text-muted-foreground">
            <p>Please select a habit to view its statistics.</p>
          </div>
        )}
        {isLoading && selectedHabitId && <div className="text-center py-10 text-muted-foreground">Loading analytics...</div>}
        {error && selectedHabitId && <div className="text-center py-10 text-red-500">Error: {error}</div>}

        {selectedHabitId && !isLoading && !error && analyticsData.length === 0 && (
             <div className="text-center py-10 text-muted-foreground">
                <p>No analytics data found for the selected habit in the last {analyticsRange} days.</p>
            </div>
        )}

        {selectedHabitId && !isLoading && !error && analyticsData.length > 0 && (
          <>
            {/* Streak Over Time Line Chart */}
            <section>
              <h3 className="text-md font-semibold mb-2">Streak Over Time (Last {analyticsRange} days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="date"
                         tickFormatter={(tick) => format(parseISO(tick), 'MMM d')}
                         fontSize={10}
                         padding={{ left: 10, right: 10 }}
                         />
                  <YAxis allowDecimals={false} domain={['dataMin', 'dataMax']} fontSize={10}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{fontSize: "12px"}} />
                  <Line type="monotone" dataKey="streak" stroke="#8884d8" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} name="Streak Count" />
                </LineChart>
              </ResponsiveContainer>
            </section>

            {/* Activity Grid */}
            <section>
              <h3 className="text-md font-semibold mb-2">Daily Activity (Last {analyticsRange} days)</h3>
              <div className="grid grid-cols-7 gap-1.5 text-xs text-center">
                {/* Optionally add weekday headers here if aligning to a calendar month start */}
                {activityGridData.map((day, index) => (
                  <div key={index}
                       title={`${day.date}: ${day.logged ? 'Logged Successfully' : 'Not Logged (or Unsuccessful)'}`}
                       className={`p-1.5 sm:p-2 rounded aspect-square flex items-center justify-center transition-colors text-foreground/70
                                   ${day.logged ? 'bg-green-500/80 hover:bg-green-500' : 'bg-muted/50 hover:bg-muted'}`}
                  >
                    {day.dayOfMonth}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">Green indicates a successfully logged day.</p>
            </section>

            <div className="flex justify-center space-x-2 pt-4 border-t">
                {[30, 60, 90].map(r => (
                    <Button key={r} variant={analyticsRange === r ? "default" : "outline"} size="sm" onClick={() => setAnalyticsRange(r)}>
                        Last {r} Days
                    </Button>
                ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HabitStatsPanel;
