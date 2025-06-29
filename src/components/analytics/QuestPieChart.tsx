// src/components/analytics/QuestPieChart.tsx
'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QuestStatus } from '@prisma/client'; // Assuming QuestStatus enum is available
import { motion } from 'framer-motion';


// Define expected data structure from API for quest status breakdown
export interface QuestStatusChartData {
  labels: QuestStatus[];
  datasets: { data: number[] }[];
}

interface QuestPieChartProps {
  data: QuestStatusChartData;
  title?: string;
}

// Define colors for each quest status for consistency
// Using Tailwind-like color names for potential future integration with Tailwind config
const STATUS_COLORS: Record<QuestStatus, string> = {
  [QuestStatus.TODO]: '#60a5fa', // blue-400
  [QuestStatus.IN_PROGRESS]: '#facc15', // yellow-400
  [QuestStatus.COMPLETED]: '#4ade80', // green-400
  [QuestStatus.CANCELLED]: '#f87171', // red-400
  [QuestStatus.ON_HOLD]: '#a3a3a3', // neutral-400
};

const QuestPieChart: React.FC<QuestPieChartProps> = ({ data, title = "Quest Status Breakdown" }) => {
  if (!data || !data.labels || !data.datasets || data.datasets.length === 0) {
    return <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">No quest data available for chart.</div>;
  }

  const chartData = data.labels.map((label, index) => ({
    name: label.replace(/_/g, ' '), // Format for display
    value: data.datasets[0].data[index] || 0,
    color: STATUS_COLORS[label] || '#8884d8', // Fallback color
  }));

  const validChartData = chartData.filter(item => item.value > 0);

  if (validChartData.length === 0) {
     return <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">No quests with current statuses to display.</div>;
  }

  return (
    <motion.div
        className="bg-white dark:bg-zinc-800 p-4 md:p-6 rounded-2xl shadow-lg h-full flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-4 text-center">{title}</h3>
      <div style={{ width: '100%', height: 300 }} className="flex-grow"> {/* Ensure container has dimensions */}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={validChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} // Example custom label
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {validChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} quests`, name]}
              contentStyle={{
                backgroundColor: 'rgba(30, 41, 59, 0.9)', // zinc-800 with opacity for dark mode tooltip
                borderColor: 'rgba(55, 65, 81, 0.7)', // zinc-700
                borderRadius: '0.5rem',
                color: '#f3f4f6' // zinc-100
              }}
              itemStyle={{ color: '#f3f4f6' }}
            />
            <Legend
                formatter={(value, entry) => <span style={{ color: entry.color }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default QuestPieChart;
