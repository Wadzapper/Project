'use client';

import React, { useEffect, useState } from 'react';
import { HabitType } from '@prisma/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface LogData {
  id: string;
  habitId: string;
  habitName: string;
  habitType: HabitType;
  date: string; // YYYY-MM-DD
  isSuccess: boolean | null;
  count: number;
}

interface HabitStatsPanelProps {
  activeHabitType: HabitType; // To filter logs by GOOD or BAD
}

const COLORS_PIE = ['#00C49F', '#FF8042', '#FFBB28']; // Green for success, Orange for fail/null for BAD, Yellow for null for GOOD

// Helper to generate days of a month for heatmap
const getDaysInMonth = (year: number, month: number) // month is 0-indexed
: Date[] => {
  const firstDay = startOfMonth(new Date(year, month));
  const lastDay = endOfMonth(new Date(year, month));
  return eachDayOfInterval({ start: firstDay, end: lastDay });
};

// Heatmap specific color scale
const getHeatmapColor = (count: number) => {
  if (count === 0) return 'bg-muted/30 dark:bg-muted/20'; // No activity
  if (count === 1) return 'bg-green-200 dark:bg-green-900';
  if (count === 2) return 'bg-green-400 dark:bg-green-700';
  if (count >= 3) return 'bg-green-600 dark:bg-green-500';
  return 'bg-gray-200 dark:bg-gray-700'; // Fallback
};


const HabitStatsPanel: React.FC<HabitStatsPanelProps> = ({ activeHabitType }) => {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth(); // 0-indexed

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch logs for the current month for heatmap, and maybe last 30/90 days for pie chart
        const monthStart = format(startOfMonth(currentMonthDate), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(currentMonthDate), 'yyyy-MM-dd');

        const response = await fetch(`/api/habits/logs?habitType=${activeHabitType}&startDate=${monthStart}&endDate=${monthEnd}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch habit logs');
        }
        const data: LogData[] = await response.json();
        setLogs(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching logs for stats panel:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [activeHabitType, currentMonthDate]);

  // Prepare data for Pie Chart (Overall Success Rate for the fetched logs period)
  const pieChartData = logs.reduce((acc, log) => {
    if (log.isSuccess === true) {
      acc[0].value += 1; // Success
    } else if (log.isSuccess === false) {
      acc[1].value += 1; // Failure
    } else { // isSuccess is null
      // For GOOD habits, null might be treated as neutral or pending. For BAD, as neutral.
      // Let's count them separately for now.
      acc[2].value +=1;
    }
    return acc;
  }, [
    { name: 'Successful Logs', value: 0 },
    { name: 'Failed Logs', value: 0 },
    { name: 'Other Logs (e.g. neutral)', value: 0 },
  ]).filter(item => item.value > 0);


  // Prepare data for Heatmap
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const heatmapData = daysInMonth.map(dayDate => {
    const dayStr = format(dayDate, 'yyyy-MM-dd');
    const logsOnDay = logs.filter(log => log.date === dayStr && log.isSuccess); // Count successful logs
    return {
      date: dayStr,
      dayOfMonth: format(dayDate, 'd'),
      count: logsOnDay.length, // Number of successful logs on this day for the active habit type
    };
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDayOfMonthOffset = startOfMonth(new Date(currentYear, currentMonth)).getDay(); // 0 for Sunday, 1 for Monday...


  if (isLoading) return <div className="p-4 text-center text-muted-foreground">Loading stats...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Habit Insights ({activeHabitType === HabitType.GOOD ? "Trackers" : "Breakers"})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Monthly Activity Heatmap */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-md font-semibold">Monthly Activity Heatmap</h4>
            {/* Month Navigation */}
            <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() -1, 1))}>Prev</Button>
                <span className="text-sm font-medium">{format(currentMonthDate, 'MMMM yyyy')}</span>
                <Button size="sm" variant="outline" onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next</Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {weekDays.map(day => <div key={day} className="font-medium text-muted-foreground">{day}</div>)}
            {Array.from({ length: firstDayOfMonthOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {heatmapData.map(day => (
              <div key={day.date} title={`${day.date}: ${day.count} successful logs`}
                   className={`w-full aspect-square rounded-sm flex items-center justify-center ${getHeatmapColor(day.count)} transition-colors`}>
                {day.dayOfMonth}
              </div>
            ))}
          </div>
           <p className="text-xs text-muted-foreground mt-2">Cells colored by number of successful logs for {activeHabitType === HabitType.GOOD ? "trackers" : "breakers"} on that day.</p>
        </div>

        {/* Overall Success Rate Pie Chart */}
        {logs.length > 0 && pieChartData.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-2">Overall Log Status (Current Month)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false}
                     label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                        return ( (percent * 100) > 5 ? // Only show label if percent is > 5%
                          <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px">
                            {`${(percent * 100).toFixed(0)}%`}
                          </text> : null
                        );
                      }}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} logs`, name]}/>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
         {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No log data available for the selected period to display charts.</p>}
      </CardContent>
    </Card>
  );
};

export default HabitStatsPanel;
