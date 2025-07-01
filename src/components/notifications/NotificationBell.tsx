// src/components/notifications/NotificationBell.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Placeholder Bell Icon (replace with a proper SVG icon from a library or custom)
const BellIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);


interface NotificationBellProps {
  userId: string; // Or fetched from auth context
  onClick?: () => void; // Callback when bell is clicked, e.g., to open a list/modal
  initialUnreadCount?: number;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onClick, initialUnreadCount = 0 }) => {
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real app, you might use SWR or React Query for data fetching and caching.
    // This fetch could also be part of a global layout/provider if bell is in a header.
    const fetchUnreadCount = async () => {
      if (!userId) {
        // If no userId, don't attempt to fetch, keep count at 0 or initial.
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // The API returns { notifications: [], unreadCount: number }
        // We only need the count here.
        const response = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}&read=false`); // Fetch only unread to get count
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || 'Failed to fetch notification count');
        }
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      } catch (err: any) {
        console.error("Error fetching unread notification count:", err);
        setError(err.message);
        // Optionally set unreadCount to 0 or keep previous value on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadCount();

    // Optional: Set up polling or use WebSockets for real-time updates
    // const intervalId = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
    // return () => clearInterval(intervalId);

  }, [userId]);

  return (
    <motion.button
      onClick={onClick}
      className="relative p-2 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Notifications (${unreadCount} unread)`}
    >
      <BellIcon className="h-6 w-6" />
      {unreadCount > 0 && (
        <motion.span
          key={unreadCount} // Animate when count changes
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0 right-0 block h-5 w-5 transform -translate-y-1/3 translate-x-1/3 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-md"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
       {isLoading && <span className="sr-only">Loading notifications...</span>}
       {error && <span className="sr-only">Error loading notifications.</span>}
    </motion.button>
  );
};

export default NotificationBell;
