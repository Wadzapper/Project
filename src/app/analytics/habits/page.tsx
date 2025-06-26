'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { eachDayOfInterval, format, startOfMonth, endOfMonth, getDay, parseISO, startOfWeek } from 'date-fns';

// Assuming Habit type might be defined elsewhere, or define a simplified one for display
// For this analytics page, we might fetch aggregated data rather than full HabitDisplay objects.
// interface HabitDisplay {
//   id: string;
//   name: string;
//   type: 'GOOD' | 'BAD'; // HabitType
//   goalType: 'DAILY' | 'WEEKLY' | 'TIMES_PER_PERIOD'; // HabitGoalType
//   frequency: number;
// }

// interface HabitLogDisplay {
    id: string;
    date: string; // ISO
    note?: string | null;
    isSuccess?: boolean | null;
    count: number;
}

interface ComplianceDataPoint {
  periodLabel: string;
  logged: number;
  expected: number;
  successRate: number;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


export default function HabitsAnalyticsPage() {
  const [userHabits, setUserHabits] = useState<HabitDisplay[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');

  const [complianceData, setComplianceData] = useState<ComplianceDataPoint[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLogDisplay[]>([]); // For specific habit logs display
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map()); // date -> count/flag

  const [compliancePeriod, setCompliancePeriod] = useState('30d');
  const [complianceGroupBy, setComplianceGroupBy] = useState('day');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());


  const [isLoadingHabits, setIsLoadingHabits] = useState(true);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false); // For a detailed log view if implemented
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all user habits for the dropdown
  useEffect(() => {
    const fetchHabits = async () => {
      setIsLoadingHabits(true);
      try {
        const res = await fetch('/api/habits'); // Assuming an API endpoint for habits CRUD (to be built in M5)
        if (!res.ok) throw new Error('Failed to fetch habits');
        const data = await res.json();
        setUserHabits(data);
        if (data.length > 0) {
          setSelectedHabitId(data[0].id);
        }
      } catch (err: any) { setError(err.message); }
      finally { setIsLoadingHabits(false); }
    };
    // For now, as /api/habits doesn't exist, let's use placeholder or skip
    // fetchHabits();
    setIsLoadingHabits(false); // TEMP
    setUserHabits([ // TEMP Placeholder
        {id: 'habit1', name: 'Workout', type: 'GOOD', goalType: 'DAILY', frequency: 1},
        {id: 'habit2', name: 'Read 30 Mins', type: 'GOOD', goalType: 'DAILY', frequency: 1},
        {id: 'habit3', name: 'No Sugar', type: 'BAD', goalType: 'DAILY', frequency: 1},
    ]);
    if (userHabits.length > 0 && !selectedHabitId) setSelectedHabitId(userHabits[0].id); // Select first if not already
    else if (userHabits.length === 0 && !selectedHabitId && !isLoadingHabits) setSelectedHabitId('habit1'); // Default if empty for placeholders

  }, []); // Run once

  // Fetch Compliance Data
  useEffect(() => {
    if (!selectedHabitId) return;
    const fetchCompliance = async () => {
      setIsLoadingCompliance(true);
      try {
        const res = await fetch(`/api/analytics/habits/compliance?habitId=${selectedHabitId}&period=${compliancePeriod}&groupBy=${complianceGroupBy}`);
        if (!res.ok) throw new Error('Failed to fetch compliance data');
        const data = await res.json(); // Expects { habitName, habitType, data: ComplianceDataPoint[] }
        setComplianceData(data.data || []);
      } catch (err: any) { setError(err.message); setComplianceData([]); }
      finally { setIsLoadingCompliance(false); }
    };
    fetchCompliance();
  }, [selectedHabitId, compliancePeriod, complianceGroupBy]);

  // Fetch Heatmap Data for selected habit (simplified: count logs per day)
   useEffect(() => {
    if (!selectedHabitId) return;
    const fetchHeatmap = async () => {
      setIsLoadingHeatmap(true);
      try {
        // This API needs to be specific for habit logs, not journal.
        // For MVP, let's assume a similar structure or adapt.
        // const res = await fetch(`/api/analytics/habits/logs-by-date?habitId=${selectedHabitId}&year=${heatmapYear}`);
        // if (!res.ok) throw new Error('Failed to fetch habit heatmap data');
        // const data: Array<{date: string, count: number}> = await res.json();
        // const map = new Map(data.map(d => [d.date, d.count]));
        // setHeatmapData(map);

        // Placeholder for heatmap until habit log API is more defined
        console.warn("Habit heatmap data fetching not fully implemented with dedicated API yet.");
        const placeholderMap = new Map<string, number>();
        // Add some dummy data for the selected year
        const d1 = format(new Date(heatmapYear, 0, 15), 'yyyy-MM-dd'); // Jan 15
        const d2 = format(new Date(heatmapYear, 0, 20), 'yyyy-MM-dd'); // Jan 20
        placeholderMap.set(d1, 1);
        placeholderMap.set(d2, 3);
        setHeatmapData(placeholderMap);

      } catch (err: any) { setError(err.message); setHeatmapData(new Map()); }
      finally { setIsLoadingHeatmap(false); }
    };
    fetchHeatmap();
  }, [selectedHabitId, heatmapYear]);


  const generateCalendarGrid = (year: number, data: Map<string,number>) => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    return months.map(monthIndex => {
      const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
      const firstDayOfMonth = startOfMonth(new Date(year, monthIndex, 1));
      const lastDayOfMonth = endOfMonth(firstDayOfMonth);
      const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
      let firstDayOfWeek = getDay(firstDayOfMonth);
      if (daysOfWeek[0] === 'Mon') firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;

      return (
        <div key={monthIndex} className="mb-4 p-2 border dark:border-gray-700 rounded">
          <h4 className="font-semibold text-sm mb-2 text-center dark:text-gray-300">{monthName} {year}</h4>
          <div className="grid grid-cols-7 gap-1 text-xs text-center">
            {daysOfWeek.map(day => <div key={day} className="font-medium dark:text-gray-400">{day}</div>)}
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}
            {daysInMonth.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const count = data.get(dayKey) || 0;
              let bgColor = 'bg-gray-200 dark:bg-gray-700';
              if (count > 0) bgColor = 'bg-green-300 dark:bg-green-600';
              if (count > 2) bgColor = 'bg-green-500 dark:bg-green-400';
              return (
                <div key={dayKey} title={`${dayKey}: ${count} log${count === 1 ? '' : 's'}`}
                     className={`w-full aspect-square rounded-sm flex items-center justify-center ${bgColor} transition-colors`}>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const selectedHabitName = userHabits.find(h => h.id === selectedHabitId)?.name || "Habit";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Habits Analytics
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}

      {isLoadingHabits ? <p>Loading habits...</p> : userHabits.length === 0 ? <p>No habits created yet.</p> : (
        <div className="mb-6">
          <label htmlFor="habitSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Habit:</label>
          <select
            id="habitSelect"
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="mt-1 block w-full sm:w-1/2 md:w-1/3 lg:w-1/4 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {userHabits.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
          </select>
        </div>
      )}

      {/* Habit Compliance Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">{selectedHabitName} - Compliance Over Time</h2>
         <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <div>
                <label htmlFor="compliancePeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="compliancePeriod" value={compliancePeriod} onChange={e => setCompliancePeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
            <div>
                <label htmlFor="complianceGroupBy" className="mr-1 dark:text-gray-300">Group by:</label>
                <select id="complianceGroupBy" value={complianceGroupBy} onChange={e => setComplianceGroupBy(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                </select>
            </div>
        </div>
        {isLoadingCompliance ? <p className="text-center py-10 dark:text-gray-300">Loading compliance data...</p> : complianceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={complianceData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" allowDecimals={false} fontSize={12} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 0, style:{fontSize:'0.75rem'} }} />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 100]} allowDecimals={false} fontSize={12} label={{ value: 'Success %', angle: 90, position: 'insideRight', offset:0, style:{fontSize:'0.75rem'} }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="logged" name="Logged" fill="#8884d8" />
              <Bar yAxisId="left" dataKey="expected" name="Expected" fill="#ccc" />
              <Line yAxisId="right" type="monotone" dataKey="successRate" name="Success Rate (%)" stroke="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No compliance data for this habit/period.</p>}
      </div>

      {/* Habit Heatmap */}
       <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{selectedHabitName} - Activity Heatmap</h2>
            <div className="text-xs">
                <label htmlFor="habitHeatmapYear" className="mr-1 dark:text-gray-300">Year:</label>
                <select id="habitHeatmapYear" value={heatmapYear} onChange={e => setHeatmapYear(parseInt(e.target.value))} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
        </div>
        {isLoadingHeatmap ? <p className="text-center py-10 dark:text-gray-300">Loading heatmap data...</p> : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {generateCalendarGrid(heatmapYear, heatmapData)}
            </div>
        )}
      </div>
    </div>
  );
}
