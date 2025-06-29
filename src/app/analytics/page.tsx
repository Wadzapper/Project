// src/app/analytics/page.tsx
'use client'; // This page will fetch data client-side

import React, { useState, useEffect } from 'react';
import StatsCard from '@/components/analytics/StatsCard';
import QuestPieChart, { QuestStatusChartData } from '@/components/analytics/QuestPieChart';
import { motion } from 'framer-motion';

// Define a comprehensive type for the expected API response
interface AnalyticsData {
  userId: string;
  totalQuests: number;
  completedQuestsCount: number;
  questsCompletionPercentage: number;
  questStatusCounts: Record<string, number>;
  questPriorityCounts: Record<string, number>;
  questStatusChartData: QuestStatusChartData; // Use the imported type
  questPriorityChartData: QuestStatusChartData; // Assuming similar structure for priority
  totalSkills: number;
  averageSkillLevel: number;
  highestLevelSkill: { name: string; level: number } | null;
  longestCurrentHabitStreak: number;
  overallLongestHabitStreak: number;
  totalPaths: number;
  averagePathCompletionPercentage: number;
}

// Placeholder icons (replace with actual SVG components or library icons)
const PlaceholderIcon = ({ className }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const QuestIcon = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.586l-.293-.293a1 1 0 00-1.414 0L2 12.586V6zM14.586 11L12 13.586V12a2 2 0 012-2h4V6a2 2 0 00-2-2h-1.172a3 3 0 00-2.12.879l-.83.828A1 1 0 0011.172 6H10v1h1.172a1 1 0 00.707-.293L13 5.414V11zM9 11a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1H9.667a1 1 0 01-.822-.445L7.5 13H4a1 1 0 01-1-1v-2a1 1 0 011-1h3.5l1.333 2H9V11z" clipRule="evenodd"></path></svg>;
const SkillIcon = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3.5a1 1 0 00.788 1.84L10 5.36l6.606 2.061a1 1 0 00.788-1.84l-7-3.5zM3 9V7.414l7-3.5 7 3.5V9l-7 3.5-7-3.5zm0 5V12.414l7-3.5 7 3.5V14l-7 3.5-7-3.5z"></path></svg>;
const HabitIcon = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path></svg>;
const PathIcon = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM1 15a1 1 0 100 2h18a1 1 0 100-2H1z"></path></svg>;


export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const userId = "demo-user"; // Placeholder

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!userId) {
        setError("User ID is not available.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analytics?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || `Failed to fetch analytics: ${response.status}`);
        }
        const data: AnalyticsData = await response.json();
        setAnalyticsData(data);
      } catch (err: any) {
        console.error('Error fetching analytics:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [userId]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen bg-zinc-50 dark:bg-zinc-900"><p className="text-lg">Loading analytics...</p></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen bg-zinc-50 dark:bg-zinc-900"><p className="text-lg text-red-500">Error: {error}</p></div>;
  }

  if (!analyticsData) {
    return <div className="flex justify-center items-center h-screen bg-zinc-50 dark:bg-zinc-900"><p className="text-lg">No analytics data found.</p></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6 md:p-8">
      <motion.header
        className="mb-8 md:mb-12 text-center"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-800 dark:text-zinc-100">
          Your Progress Dashboard
        </h1>
        <p className="text-md sm:text-lg text-zinc-600 dark:text-zinc-400 mt-3">
          An overview of your achievements and activities.
        </p>
      </motion.header>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
        initial="hidden"
        animate="visible"
        variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        <StatsCard label="Total Quests" value={analyticsData.totalQuests} icon={<QuestIcon />} color="bg-blue-500" description={`${analyticsData.questsCompletionPercentage}% completed`} />
        <StatsCard label="Avg. Skill Level" value={analyticsData.averageSkillLevel || 0} icon={<SkillIcon />} color="bg-green-500" description={analyticsData.highestLevelSkill ? `Highest: ${analyticsData.highestLevelSkill.name} (Lvl ${analyticsData.highestLevelSkill.level})` : `Total Skills: ${analyticsData.totalSkills}`} />
        <StatsCard label="Longest Habit Streak" value={analyticsData.overallLongestHabitStreak} icon={<HabitIcon />} color="bg-yellow-500" description={`Current Longest: ${analyticsData.longestCurrentHabitStreak} days`} />
        <StatsCard label="Total Paths" value={analyticsData.totalPaths} icon={<PathIcon />} color="bg-purple-500" description={`${analyticsData.averagePathCompletionPercentage}% avg. completion`} />
      </motion.div>

      <div className="mt-8 md:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {analyticsData.questStatusChartData && (
            <QuestPieChart data={analyticsData.questStatusChartData} title="Quest Status Breakdown" />
        )}
        {analyticsData.questPriorityChartData && (
             <QuestPieChart data={analyticsData.questPriorityChartData} title="Quest Priority Breakdown" />
        )}
        {/* Placeholder for other charts/visualizations */}
        {/* <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg"> More charts here... </div> */}
      </div>

      {/* Placeholder sections for future analytics */}
      <div className="mt-8 md:mt-12 text-center">
        <h2 className="text-2xl font-semibold text-zinc-700 dark:text-zinc-200 mb-4">More Insights Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-md"><h3 className="font-medium">Top Skills</h3><p className="text-sm text-zinc-500 dark:text-zinc-400">Detailed view of your most developed skills.</p></div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-md"><h3 className="font-medium">Quest Completion Trends</h3><p className="text-sm text-zinc-500 dark:text-zinc-400">Track your quest completion rate over time.</p></div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-md"><h3 className="font-medium">Habit Consistency</h3><p className="text-sm text-zinc-500 dark:text-zinc-400">Visualize your habit adherence.</p></div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-md"><h3 className="font-medium">Path Engagement</h3><p className="text-sm text-zinc-500 dark:text-zinc-400">See which paths you're most active in.</p></div>
        </div>
      </div>

    </div>
  );
}
