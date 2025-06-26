'use client'; // For data fetching and state

import { useEffect, useState } from 'react';
import QuickStatCard from '@/components/analytics/QuickStatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link'; // Import Link for drilldown

// Define types for summary data
interface SkillsSummary {
  totalXpAllTime: number;
  totalXpThisMonth: number;
  totalXpThisWeek: number;
  totalXpToday: number;
  totalXpYesterday: number;
  leveledUpSkillsCount: number;
  topSkillsByLevel: { id: string; name: string; currentLevel: number; currentXp: number; targetXpForNextLevel: number }[]; // Added id and more details
  topSkillsByXpGainThisMonth: { skillId: string; name: string; totalXpGained: number | null }[]; // Added skillId
}

interface QuestsSummary {
  statusCounts: { [key: string]: number }; // QuestStatus as key
  totalQuests: number;
  completedQuests: number;
  completionRate: number;
}

interface HabitsSummary {
    totalHabits: number;
    goodHabitsCount: number;
    badHabitsCount: number;
    totalHabitLogsToday: number;
}

interface RatingTrendPoint {
    date: string; // YYYY-MM-DD
    value: number | null;
}


export default function AnalyticsOverviewPage() {
  const [skillsSummary, setSkillsSummary] = useState<SkillsSummary | null>(null);
  const [questsSummary, setQuestsSummary] = useState<QuestsSummary | null>(null);
  const [habitsSummary, setHabitsSummary] = useState<HabitsSummary | null>(null);
  const [moodTrend, setMoodTrend] = useState<RatingTrendPoint[]>([]);
  const [productivityTrend, setProductivityTrend] = useState<RatingTrendPoint[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [skillsRes, questsRes, habitsRes, moodRes, prodRes] = await Promise.all([
          fetch('/api/analytics/skills/summary'),
          fetch('/api/analytics/quests/summary'),
          fetch('/api/analytics/habits/summary'),
          fetch('/api/analytics/ratings/trends?metric=mood&period=7d'),
          fetch('/api/analytics/ratings/trends?metric=productivity&period=7d'),
        ]);

        if (!skillsRes.ok) throw new Error('Failed to fetch skills summary');
        setSkillsSummary(await skillsRes.json());

        if (!questsRes.ok) throw new Error('Failed to fetch quests summary');
        setQuestsSummary(await questsRes.json());

        if (!habitsRes.ok) throw new Error('Failed to fetch habits summary');
        setHabitsSummary(await habitsRes.json());

        if (!moodRes.ok) throw new Error('Failed to fetch mood trends');
        setMoodTrend(await moodRes.json());

        if (!prodRes.ok) throw new Error('Failed to fetch productivity trends');
        setProductivityTrend(await prodRes.json());

      } catch (err: any) {
        setError(err.message || 'Failed to load overview data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) return <div className="text-center p-8">Loading analytics overview...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  // Combine mood and productivity for a multi-line chart
  const combinedRatingTrends = moodTrend.map((moodPoint, index) => ({
    date: new Date(moodPoint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Mood: moodPoint.value,
    Productivity: productivityTrend[index]?.value, // Assume same length and order
  }));

  const PIE_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];


  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Analytics Overview
      </h1>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {skillsSummary && (
          <QuickStatCard title="Total XP This Week" value={skillsSummary.totalXpThisWeek} icon="💪" />
        )}
        {questsSummary && (
          <QuickStatCard title="Quests Completed" value={`${questsSummary.completedQuests} / ${questsSummary.totalQuests}`} description={`Rate: ${questsSummary.completionRate}%`} icon="🎯" />
        )}
        {habitsSummary && (
          <QuickStatCard title="Active Habits" value={habitsSummary.totalHabits} description={`Logged today: ${habitsSummary.totalHabitLogsToday}`} icon="🔁" />
        )}
         {/* Placeholder for a key rating or journal stat */}
        <QuickStatCard title="Avg Mood (7d)" value={moodTrend.reduce((acc, curr) => acc + (curr.value || 0), 0) / (moodTrend.filter(m => m.value !== null).length || 1) || 0} icon="😊" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Ratings Trend Chart */}
        <div className="p-4 bg-white rounded-lg shadow-md dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Daily Ratings (Last 7 Days)</h2>
          {combinedRatingTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedRatingTrends}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis domain={[0, 5]} allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Mood" stroke="#8884d8" activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Productivity" stroke="#82ca9d" activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No rating data for the last 7 days.</p>}
        </div>

        {/* Quest Status Pie Chart */}
        <div className="p-4 bg-white rounded-lg shadow-md dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Quest Status Distribution</h2>
          {questsSummary && questsSummary.totalQuests > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(questsSummary.statusCounts || {}).map(([name, value]) => ({ name: name.replace('_', ' '), value }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  fontSize={12}
                >
                {Object.entries(questsSummary.statusCounts || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No quest data available.</p>}
        </div>
      </div>

      {/* Top Skills & Other Summaries */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {skillsSummary && skillsSummary.topSkillsByLevel.length > 0 && (
            <div className="p-4 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Top Skills by Level</h2>
                <ul className="space-y-2">
                    {skillsSummary.topSkillsByLevel.map(skill => (
                        <li key={skill.id} className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400">
                            <Link href={`/analytics/skills?skillId=${skill.id}`}>
                                {skill.name} - Lvl {skill.currentLevel} ({skill.currentXp}/{skill.targetXpForNextLevel} XP)
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        )}
        {skillsSummary && skillsSummary.topSkillsByXpGainThisMonth.length > 0 && (
             <div className="p-4 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Top XP Gain (This Month)</h2>
                 <ul className="space-y-2">
                    {skillsSummary.topSkillsByXpGainThisMonth.map(skill => (
                        <li key={skill.skillId} className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400">
                           <Link href={`/analytics/skills?skillId=${skill.skillId}`}>
                                {skill.name} - {skill.totalXpGained || 0} XP gained
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        )}
       </div>

    </div>
  );
}
