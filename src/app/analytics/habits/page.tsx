'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Line } from 'recharts'; // Aliased Recharts Tooltip
import { eachDayOfInterval, format, startOfMonth, endOfMonth, getDay, parseISO, startOfWeek } from 'date-fns';
import { Loader2, ArrowLeft, CalendarRange } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added Tooltip imports

// Simplified interface for habits listed in dropdown
interface HabitDisplay {
  id: string;
  name: string;
}

// Interface for data points shown in the compliance chart
interface ComplianceDataPoint {
  periodLabel: string; // e.g., "Jan 1", "Week 1"
  logged: number;      // Actual logs for the period
  expected: number;    // Expected logs based on habit frequency
  successRate: number; // (logged / expected) * 100
}

// Interface for heatmap data points (date -> count)
// Using a Map for this: Map<string, number> where string is 'yyyy-MM-dd'

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Adjust if week starts on Monday based on locale

export default function HabitsAnalyticsPage() {
  const router = useRouter();
  const [userHabits, setUserHabits] = useState<HabitDisplay[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');

  const [complianceData, setComplianceData] = useState<ComplianceDataPoint[]>([]);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());

  const [compliancePeriod, setCompliancePeriod] = useState('30d');
  const [complianceGroupBy, setComplianceGroupBy] = useState('day');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

  const [isLoadingHabits, setIsLoadingHabits] = useState(true);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHabits = async () => {
      setIsLoadingHabits(true);
      setError(null); // Clear previous errors
      try {
        const res = await fetch('/api/habits');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch habits');
        }
        const data = await res.json();
        setUserHabits(data.map((h: any) => ({ id: h.id, name: h.name }))); // Simplify for dropdown
        if (data.length > 0) {
          setSelectedHabitId(data[0].id);
        } else {
          toast.success("No habits found. Create some habits to see analytics.");
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(`Error fetching habits: ${err.message}`);
      }
      finally { setIsLoadingHabits(false); }
    };
    fetchHabits();
  }, []);

  useEffect(() => {
    if (!selectedHabitId) {
        setComplianceData([]); // Clear data if no habit is selected
        return;
    }
    const fetchCompliance = async () => {
      setIsLoadingCompliance(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/habits/compliance?habitId=${selectedHabitId}&period=${compliancePeriod}&groupBy=${complianceGroupBy}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch compliance data');
        }
        const data = await res.json();
        setComplianceData(data.data || []);
      } catch (err: any) {
        setError(err.message);
        setComplianceData([]);
        toast.error(`Error fetching compliance: ${err.message}`);
      }
      finally { setIsLoadingCompliance(false); }
    };
    fetchCompliance();
  }, [selectedHabitId, compliancePeriod, complianceGroupBy]);

   useEffect(() => {
    if (!selectedHabitId) {
        setHeatmapData(new Map()); // Clear data if no habit is selected
        return;
    }
    const fetchHeatmap = async () => {
      setIsLoadingHeatmap(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/habits/heatmap?habitId=${selectedHabitId}&year=${heatmapYear}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch habit heatmap data');
        }
        const data: Array<{date: string, count: number}> = await res.json();
        const map = new Map(data.map(d => [format(parseISO(d.date), 'yyyy-MM-dd'), d.count]));
        setHeatmapData(map);
      } catch (err: any) {
        setError(err.message);
        setHeatmapData(new Map());
        toast.error(`Error fetching heatmap: ${err.message}`);
      }
      finally { setIsLoadingHeatmap(false); }
    };
    fetchHeatmap();
  }, [selectedHabitId, heatmapYear]);

  const generateCalendarGrid = (year: number, data: Map<string,number>) => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    return months.map(monthIndex => {
      const monthName = format(new Date(year, monthIndex), 'MMMM');
      const firstDayOfMonth = startOfMonth(new Date(year, monthIndex, 1));
      const lastDayOfMonth = endOfMonth(firstDayOfMonth);
      const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
      // Adjust start day based on locale if `daysOfWeek` starts with Monday
      let firstDayOfWeekIndex = getDay(firstDayOfMonth); // Sunday is 0, Saturday is 6

      return (
        <div key={monthIndex} className="mb-4 p-3 bg-bg-card border border-border-secondary rounded-lg shadow">
          <h4 className="font-semibold text-sm mb-3 text-center text-text-primary">{monthName} {year}</h4>
          <div className="grid grid-cols-7 gap-1 text-xs text-center">
            {daysOfWeek.map(day => <div key={day} className="font-medium text-text-secondary">{day}</div>)}
            {Array(firstDayOfWeekIndex).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}
            {daysInMonth.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const count = data.get(dayKey) || 0;
              let bgColor = 'bg-gray-200 dark:bg-gray-700 opacity-50'; // Default for no logs
              if (count > 0) bgColor = 'bg-success/30 dark:bg-success/40'; // Light success
              if (count > 1) bgColor = 'bg-success/60 dark:bg-success/70'; // Medium success
              if (count > 3) bgColor = 'bg-success dark:bg-success';       // Full success
              return (
                <TooltipProvider key={dayKey}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`w-full aspect-square rounded-sm flex items-center justify-center ${bgColor} transition-colors hover:opacity-80`}>
                        <span className="text-xxs text-black/60 dark:text-white/70">{format(day, 'd')}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-bg-card border-border-primary text-text-primary">
                      {format(day, 'MMM d, yyyy')}: {count} log{count === 1 ? '' : 's'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const selectedHabitName = userHabits.find(h => h.id === selectedHabitId)?.name || "Selected Habit";

  const complianceChartData = complianceData.map(d => ({
    ...d,
    successRate: parseFloat(d.successRate.toFixed(1)), // Ensure it's a number for Recharts
  }));

  const tooltipStyle = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-primary)',
    color: 'var(--color-text-primary)',
  };
  const tickFill = 'var(--color-text-secondary)';
  const gridStroke = 'var(--color-border-secondary)';
  const legendStyle = { color: 'var(--color-text-secondary)', fontSize: '12px' };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
        <h1 className="text-3xl font-bold text-text-primary">Habit Analytics</h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4 text-text-secondary" /> Back
        </Button>
      </div>

      {error && !isLoadingHabits && !isLoadingCompliance && !isLoadingHeatmap && (
        <p className="text-red-500 dark:text-red-400 mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
          Error loading some analytics data: {error}
        </p>
      )}

      {isLoadingHabits ? (
          <div className="text-center py-10 text-text-secondary"><Loader2 className="mr-2 h-6 w-6 animate-spin inline"/> Loading habits...</div>
      ) : userHabits.length === 0 ? (
        <p className="text-center py-10 text-text-secondary">No habits created yet. Add some habits to see analytics.</p>
      ) : (
        <div className="mb-6">
          <Label htmlFor="habitSelect" className="block text-sm font-medium text-text-secondary mb-1">Select Habit:</Label>
          <Select value={selectedHabitId} onValueChange={setSelectedHabitId}>
            <SelectTrigger id="habitSelect" className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary">
                <SelectValue placeholder="Select a habit" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                {userHabits.map(habit => <SelectItem key={habit.id} value={habit.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">{habit.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedHabitId && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-text-primary">{selectedHabitName} - Compliance Over Time</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <div>
                      <Label htmlFor="compliancePeriod" className="mr-1 text-text-secondary">Period:</Label>
                      <Select value={compliancePeriod} onValueChange={setCompliancePeriod}>
                          <SelectTrigger id="compliancePeriod" className="p-1 h-7 text-xs bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                            <SelectItem value="7d" className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">Last 7 Days</SelectItem>
                            <SelectItem value="30d" className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">Last 30 Days</SelectItem>
                            <SelectItem value="90d" className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">Last 90 Days</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div>
                      <Label htmlFor="complianceGroupBy" className="mr-1 text-text-secondary">Group by:</Label>
                       <Select value={complianceGroupBy} onValueChange={setComplianceGroupBy}>
                          <SelectTrigger id="complianceGroupBy" className="p-1 h-7 text-xs bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                            <SelectItem value="day" className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">Day</SelectItem>
                            <SelectItem value="week" className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">Week</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="h-[350px]">
            {isLoadingCompliance ? (
                <div className="flex justify-center items-center h-full text-text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Loading compliance data...</div>
            ) : complianceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complianceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.3} />
                  <XAxis dataKey="periodLabel" fontSize={12} stroke={gridStroke} tick={{ fill: tickFill }} />
                  <YAxis yAxisId="left" orientation="left" stroke="var(--color-info)" allowDecimals={false} fontSize={12} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 0, style:{fontSize:'0.75rem', fill: tickFill} }} tick={{ fill: tickFill }} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--color-success)" domain={[0, 100]} allowDecimals={false} fontSize={12} label={{ value: 'Success %', angle: 90, position: 'insideRight', offset:0, style:{fontSize:'0.75rem', fill: tickFill} }} tick={{ fill: tickFill }} />
                  <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--color-accent-primary)', fillOpacity: 0.1}}/>
                  <Legend wrapperStyle={legendStyle} />
                  <Bar yAxisId="left" dataKey="logged" name="Logged" fill="var(--color-info)" radius={[4,4,0,0]}/>
                  <Bar yAxisId="left" dataKey="expected" name="Expected" fill="var(--color-border-secondary)" radius={[4,4,0,0]}/>
                  <Line yAxisId="right" type="monotone" dataKey="successRate" name="Success Rate (%)" stroke="var(--color-success)" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-text-secondary text-center py-10">No compliance data for this habit/period.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap justify-between items-center">
                  <CardTitle className="text-text-primary">{selectedHabitName} - Activity Heatmap</CardTitle>
                  <div className="text-xs">
                      <Label htmlFor="habitHeatmapYear" className="mr-1 text-text-secondary">Year:</Label>
                      <Select value={String(heatmapYear)} onValueChange={val => setHeatmapYear(parseInt(val))}>
                          <SelectTrigger id="habitHeatmapYear" className="p-1 h-7 text-xs bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                            {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y =>
                                <SelectItem key={y} value={String(y)} className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800">{y}</SelectItem>
                            )}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
            </CardHeader>
            <CardContent>
            {isLoadingHeatmap ? (
                <div className="flex justify-center items-center h-[200px] text-text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Loading heatmap data...</div>
            ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {generateCalendarGrid(heatmapYear, heatmapData)}
                </div>
            )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
