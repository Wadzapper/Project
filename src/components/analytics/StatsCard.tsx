// src/components/analytics/StatsCard.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode; // Optional: e.g., an SVG icon component
  color?: string; // Optional: for accent color, e.g., 'bg-blue-500' or a hex code for inline style
  description?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, color, description }) => {
  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </h3>
        {icon && (
          <div className={`p-2 rounded-lg ${color || 'bg-zinc-100 dark:bg-zinc-700'}`}>
            {React.cloneElement(icon as React.ReactElement, { className: `h-5 w-5 ${color ? 'text-white' : 'text-zinc-500 dark:text-zinc-300'}` })}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">
        {value}
      </p>
      {description && (
         <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
    </motion.div>
  );
};

export default StatsCard;
