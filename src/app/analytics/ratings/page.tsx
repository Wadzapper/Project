'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

type ValidRatingMetric = 'productivity' | 'mood' | 'energy' | 'stress' | 'focus';
const RATING_METRICS: { key: ValidRatingMetric, name: string, color: string }[] = [
    { key: 'productivity', name: 'Productivity', color: '#8884d8' },
    { key: 'mood', name: 'Mood', color: '#82ca9d' },
    { key: 'energy', name: 'Energy', color: '#ffc658' },
    { key: 'stress', name: 'Stress', color: '#ff7300' },
    { key: 'focus', name: 'Focus', color: '#00C49F' },
];

interface RatingTrendPoint {
  date: string; // Formatted for display
  value: number | null;
}

interface AverageRatingData {
    metric: string; // e.g. "Productivity"
    value: number;  // Average value
    fullMark?: number; // Max value for radar chart scale, e.g. 5
}


export default function RatingsAnalyticsPage() {
  const [trendsData, setTrendsData] = useState<RatingTrendPoint[]>([]);
  const [averageData, setAverageData] = useState<AverageRatingData[]>([]);

  const [selectedTrendMetric, setSelectedTrendMetric] = useState<ValidRatingMetric>('mood');
  const [trendPeriod, setTrendPeriod] = useState('30d');
  const [averagesPeriod, setAveragesPeriod] = useState('30d');

  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingAverages, setIsLoadingAverages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Trend Data
  useEffect(() => {
    const fetchTrendData = async () => {
      setIsLoadingTrends(true);
      try {
        const res = await fetch(`/api/analytics/ratings/trends?metric=${selectedTrendMetric}&period=${trendPeriod}`);
        if (!res.ok) throw new Error(`Failed to fetch ${selectedTrendMetric} trends`);
        const data = await res.json();
        setTrendsData(data.map((d:any) => ({...d, date: new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}) })));
      } catch (err: any) {
        setError(err.message); setTrendsData([]);
      } finally {
        setIsLoadingTrends(false);
      }
    };
    fetchTrendData();
  }, [selectedTrendMetric, trendPeriod]);

  // Fetch Averages Data
  useEffect(() => {
    const fetchAveragesData = async () => {
      setIsLoadingAverages(true);
      try {
        const res = await fetch(`/api/analytics/ratings/averages?period=${averagesPeriod}`);
        if (!res.ok) throw new Error('Failed to fetch rating averages');
        let data: AverageRatingData[] = await res.json();
        // Add fullMark for radar chart
        data = data.map(d => ({...d, fullMark: 5})); // Assuming 1-5 scale
        setAverageData(data);
      } catch (err: any) {
        setError(err.message); setAverageData([]); // Use shared error state or separate
      } finally {
        setIsLoadingAverages(false);
      }
    };
    fetchAveragesData();
  }, [averagesPeriod]);


  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Daily Ratings Analytics
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}

      {/* Rating Trends Line Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Rating Trends</h2>
            <div className="flex flex-wrap gap-2 text-xs">
                <div>
                    <label htmlFor="trendMetric" className="mr-1 dark:text-gray-300">Metric:</label>
                    <select id="trendMetric" value={selectedTrendMetric} onChange={e => setSelectedTrendMetric(e.target.value as ValidRatingMetric)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        {RATING_METRICS.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="trendPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                    <select id="trendPeriod" value={trendPeriod} onChange={e => setTrendPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                    </select>
                </div>
            </div>
        </div>
        {isLoadingTrends ? <p className="text-center py-10 dark:text-gray-300">Loading trends...</p> : trendsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis domain={[0, 5]} allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" name={RATING_METRICS.find(m=>m.key === selectedTrendMetric)?.name || 'Value'} stroke={RATING_METRICS.find(m=>m.key === selectedTrendMetric)?.color || '#8884d8'} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No rating data for this metric/period.</p>}
      </div>

      {/* Average Ratings Radar Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Average Ratings</h2>
             <div className="text-xs">
                <label htmlFor="averagesPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="averagesPeriod" value={averagesPeriod} onChange={e => setAveragesPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
        </div>
        {isLoadingAverages ? <p className="text-center py-10 dark:text-gray-300">Loading averages...</p> : averageData.some(d => d.value > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={averageData}>
              <PolarGrid strokeOpacity={0.3}/>
              <PolarAngleAxis dataKey="metric" fontSize={12} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} fontSize={10} />
              <Radar name="Average" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No average rating data for this period.</p>}
      </div>
    </div>
  );
}
