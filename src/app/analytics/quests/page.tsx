'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { QuestType as PrismaQuestType } from '@prisma/client'; // Import enum for dropdown

interface TimelineDataPoint {
  period: string;
  count: number;
}

interface StatusDistributionPoint {
  name: string; // Status name e.g. "COMPLETED"
  value: number;
}

const PIE_CHART_COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884D8', '#DA70D6']; // Green, Blue, Yellow, Orange, Purple, Orchid


export default function QuestsAnalyticsPage() {
  const [completionTimeline, setCompletionTimeline] = useState<TimelineDataPoint[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistributionPoint[]>([]);
  const [timelinePeriod, setTimelinePeriod] = useState('30d');
  const [timelineGroupBy, setTimelineGroupBy] = useState('day');
  const [selectedQuestType, setSelectedQuestType] = useState<string>(''); // All types initially

  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimelineData = async () => {
      setIsLoadingTimeline(true);
      try {
        let apiUrl = `/api/analytics/quests/completion-timeline?period=${timelinePeriod}&groupBy=${timelineGroupBy}`;
        if (selectedQuestType) {
          apiUrl += `&questType=${selectedQuestType}`;
        }
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Failed to fetch quest completion timeline');
        const data = await res.json();
        setCompletionTimeline(data);
      } catch (err: any) {
        setError(err.message); // Consider a shared error state or more specific error handling
        setCompletionTimeline([]);
      } finally {
        setIsLoadingTimeline(false);
      }
    };
    fetchTimelineData();
  }, [timelinePeriod, timelineGroupBy, selectedQuestType]);

  useEffect(() => {
    const fetchStatusData = async () => {
      setIsLoadingStatus(true);
      try {
        // Using the summary endpoint which provides statusCounts
        const res = await fetch(`/api/analytics/quests/summary`);
        if (!res.ok) throw new Error('Failed to fetch quest status distribution');
        const data = await res.json();
        if (data.statusCounts) {
            setStatusDistribution(
                Object.entries(data.statusCounts).map(([name, value]) => ({ name: name.replace('_',' '), value: value as number}))
            );
        } else {
            setStatusDistribution([]);
        }
      } catch (err: any) {
        setError(err.message); // Could be a shared error state
        setStatusDistribution([]);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatusData();
  }, []);


  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Quests Analytics
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}

      {/* Quest Completion Timeline Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">Quest Completion Timeline</h2>
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <div>
                <label htmlFor="timelinePeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="timelinePeriod" value={timelinePeriod} onChange={e => setTimelinePeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
            <div>
                <label htmlFor="timelineGroupBy" className="mr-1 dark:text-gray-300">Group by:</label>
                <select id="timelineGroupBy" value={timelineGroupBy} onChange={e => setTimelineGroupBy(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                </select>
            </div>
            <div>
                <label htmlFor="timelineQuestType" className="mr-1 dark:text-gray-300">Quest Type:</label>
                <select id="timelineQuestType" value={selectedQuestType} onChange={e => setSelectedQuestType(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="">All Types</option>
                    {Object.values(PrismaQuestType).map(type => (
                        <option key={type} value={type}>{type.replace('_',' ')}</option>
                    ))}
                </select>
            </div>
        </div>
        {isLoadingTimeline ? <p className="text-center py-10 dark:text-gray-300">Loading timeline...</p> : completionTimeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={completionTimeline}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="period" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Quests Completed" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No quest completion data for this period/grouping.</p>}
      </div>

      {/* Quest Status Distribution Pie Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Quest Status Distribution</h2>
        {isLoadingStatus ? <p className="text-center py-10 dark:text-gray-300">Loading status distribution...</p> : statusDistribution.some(s => s.value > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution.filter(s => s.value > 0)} // Only show statuses with counts
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                fontSize={12}
              >
                {statusDistribution.filter(s => s.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No quest status data available.</p>}
      </div>
    </div>
  );
}
