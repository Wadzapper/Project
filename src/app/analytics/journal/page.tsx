'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { eachDayOfInterval, format, startOfMonth, endOfMonth, getDay, isSameDay, parseISO } from 'date-fns';

interface HeatmapDataPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

interface FrequencyDataPoint {
  period: string; // e.g., "Jan 2023", "Week 1"
  count: number;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function JournalAnalyticsPage() {
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [frequencyData, setFrequencyData] = useState<FrequencyDataPoint[]>([]);

  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [frequencyPeriod, setFrequencyPeriod] = useState('90d');
  const [frequencyGroupBy, setFrequencyGroupBy] = useState('week');

  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(true);
  const [isLoadingFrequency, setIsLoadingFrequency] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Heatmap Data
  useEffect(() => {
    const fetchHeatmap = async () => {
      setIsLoadingHeatmap(true);
      try {
        const res = await fetch(`/api/analytics/journal/heatmap-data?year=${heatmapYear}`);
        if (!res.ok) throw new Error('Failed to fetch heatmap data');
        setHeatmapData(await res.json());
      } catch (err: any) { setError(err.message); setHeatmapData([]); }
      finally { setIsLoadingHeatmap(false); }
    };
    fetchHeatmap();
  }, [heatmapYear]);

  // Fetch Frequency Data
  useEffect(() => {
    const fetchFrequency = async () => {
      setIsLoadingFrequency(true);
      try {
        const res = await fetch(`/api/analytics/journal/frequency?period=${frequencyPeriod}&groupBy=${frequencyGroupBy}`);
        if (!res.ok) throw new Error('Failed to fetch frequency data');
        setFrequencyData(await res.json());
      } catch (err: any) { setError(err.message); setFrequencyData([]); }
      finally { setIsLoadingFrequency(false); }
    };
    fetchFrequency();
  }, [frequencyPeriod, frequencyGroupBy]);

  const generateCalendarGrid = () => {
    const year = heatmapYear;
    const months = Array.from({ length: 12 }, (_, i) => i); // 0-11 for Jan-Dec
    const heatmapMap = new Map(heatmapData.map(d => [d.date, d.count]));

    return months.map(monthIndex => {
      const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
      const firstDayOfMonth = startOfMonth(new Date(year, monthIndex, 1));
      const lastDayOfMonth = endOfMonth(firstDayOfMonth);
      const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

      let firstDayOfWeek = getDay(firstDayOfMonth); // 0 for Sunday, 1 for Monday etc.
                                                    // Adjust if week starts on Monday (getDay returns 0 for Sun)
      if (firstDayOfWeek === 0 && daysOfWeek[0] === 'Mon') firstDayOfWeek = 6; // If your calendar starts Monday, Sunday is 6
      else if (daysOfWeek[0] === 'Mon') firstDayOfWeek = firstDayOfWeek -1;


      return (
        <div key={monthIndex} className="mb-4 p-2 border dark:border-gray-700 rounded">
          <h4 className="font-semibold text-sm mb-2 text-center dark:text-gray-300">{monthName} {year}</h4>
          <div className="grid grid-cols-7 gap-1 text-xs text-center">
            {daysOfWeek.map(day => <div key={day} className="font-medium dark:text-gray-400">{day}</div>)}
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}
            {daysInMonth.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const count = heatmapMap.get(dayKey) || 0;
              let bgColor = 'bg-gray-200 dark:bg-gray-700'; // Default for no entries
              if (count > 0) bgColor = 'bg-green-300 dark:bg-green-600';
              if (count > 2) bgColor = 'bg-green-500 dark:bg-green-400'; // Darker for more entries
              return (
                <div key={dayKey} title={`${dayKey}: ${count} entr${count === 1 ? 'y' : 'ies'}`}
                     className={`w-full aspect-square rounded-sm flex items-center justify-center ${bgColor} transition-colors`}>
                  {/* {day.getDate()} */}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };


  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Journal Analytics
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}

      {/* Journal Entry Frequency Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">Entry Frequency</h2>
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <div>
                <label htmlFor="freqPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="freqPeriod" value={frequencyPeriod} onChange={e => setFrequencyPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="1y">Last Year</option>
                </select>
            </div>
            <div>
                <label htmlFor="freqGroupBy" className="mr-1 dark:text-gray-300">Group by:</label>
                <select id="freqGroupBy" value={frequencyGroupBy} onChange={e => setFrequencyGroupBy(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                </select>
            </div>
        </div>
        {isLoadingFrequency ? <p className="text-center py-10 dark:text-gray-300">Loading frequency data...</p> : frequencyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={frequencyData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="period" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Entries" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No journal entry data for this period/grouping.</p>}
      </div>

      {/* Journal Calendar Heatmap */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Entry Heatmap</h2>
            <div className="text-xs">
                <label htmlFor="heatmapYearSelect" className="mr-1 dark:text-gray-300">Year:</label>
                <select id="heatmapYearSelect" value={heatmapYear} onChange={e => setHeatmapYear(parseInt(e.target.value))} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
        </div>
        {isLoadingHeatmap ? <p className="text-center py-10 dark:text-gray-300">Loading heatmap data...</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {generateCalendarGrid()}
            </div>
        )}
      </div>
    </div>
  );
}
