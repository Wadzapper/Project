'use client';

interface QuickStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode; // e.g., an SVG icon or emoji
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

const trendColors = {
  up: 'text-green-500 dark:text-green-400',
  down: 'text-red-500 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

const trendArrows = {
    up: '↑',
    down: '↓',
    neutral: '' // or '→' or some other indicator
}

export default function QuickStatCard({
  title,
  value,
  description,
  icon,
  trend,
  className = ''
}: QuickStatCardProps) {
  return (
    <div className={`p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        {icon && (
          <div className="flex-shrink-0 p-2 bg-indigo-500 rounded-md bg-opacity-20 dark:bg-opacity-30 text-indigo-500 dark:text-indigo-400">
            {icon}
          </div>
        )}
      </div>
      {description && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {trend && (
        <div className="mt-2 flex items-baseline text-xs">
          <span className={`mr-1 ${trendColors[trend.direction]}`}>
            {trendArrows[trend.direction]} {trend.value}
          </span>
          <span className="text-gray-500 dark:text-gray-400">vs previous period</span>
        </div>
      )}
    </div>
  );
}
