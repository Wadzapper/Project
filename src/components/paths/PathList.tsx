// src/components/paths/PathList.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Define Path type based on API response (including progress)
export interface PathListData {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  color?: string | null;
  createdAt: string; // Assuming ISO string from API
  updatedAt: string; // Assuming ISO string from API
  user: {
    id: string;
    username: string;
  };
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
}

interface PathListProps {
  userId: string; // Or fetched from session/auth context
}

const PathList: React.FC<PathListProps> = ({ userId }) => {
  const [paths, setPaths] = useState<PathListData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaths = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/paths?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || `Failed to fetch paths: ${response.status}`);
        }
        const data: PathListData[] = await response.json();
        setPaths(data);
      } catch (err: any) {
        console.error('Error fetching paths:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchPaths();
    } else {
      // Handle case where userId is not available (e.g., show login prompt or different UI)
      setIsLoading(false);
      setPaths([]); // Ensure paths are cleared if userId becomes null/undefined
    }
  }, [userId]);

  if (isLoading) {
    return <div className="text-center p-4">Loading paths...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  if (paths.length === 0) {
    return (
      <div className="text-center p-4">
        <p>No paths found. Start by creating a new one!</p>
        {/* Placeholder for Create New Path button/modal trigger */}
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Create New Path (Placeholder)
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {paths.map((path, index) => (
        <motion.div
          key={path.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={`bg-white dark:bg-zinc-800 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col`}
          style={{ borderColor: path.color || '#3b82f6', borderTopWidth: '4px' }} // Use path.color for top border
        >
          <div className="p-6 flex-grow">
            <h3 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-zinc-100">{path.title}</h3>
            {path.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 truncate">
                {path.description}
              </p>
            )}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                <span>Progress</span>
                <span>{path.progressPercentage}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${path.progressPercentage}%`, backgroundColor: path.color || '#3b82f6' }}
                ></div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {path.completedSteps} / {path.totalSteps} steps completed
              </p>
            </div>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-700/50 border-t border-zinc-200 dark:border-zinc-700">
            <Link href={`/paths/${path.id}`} legacyBehavior>
              <a className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                View Details &rarr;
              </a>
            </Link>
          </div>
        </motion.div>
      ))}
       {/* Placeholder for Create New Path button/modal trigger - maybe a floating action button or at the top */}
        <div className="col-span-full flex justify-center mt-6">
             <button className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-md">
                + Create New Path (Placeholder)
            </button>
        </div>
    </div>
  );
};

export default PathList;
