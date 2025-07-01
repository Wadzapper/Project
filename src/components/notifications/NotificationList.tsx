// src/components/notifications/NotificationList.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Notification as PrismaNotification } from '@prisma/client'; // Assuming Prisma types

// Extend PrismaNotification if needed, e.g., for user data if not already included by API
export interface NotificationData extends PrismaNotification {
  user?: { // User might not be included in all notification fetches from API, handle optionally
    id: string;
    username: string;
  };
}

interface NotificationListProps {
  userId: string; // Or from auth context
  // filter?: 'all' | 'read' | 'unread'; // Could be passed as prop
  onNotificationUpdate?: () => void; // Callback to refresh bell count or other UI
}

// Placeholder icons
const TrashIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EyeIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const EyeOffIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29-3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>;


const NotificationList: React.FC<NotificationListProps> = ({ userId, onNotificationUpdate }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
        setIsLoading(false);
        setNotifications([]);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const readParam = filter === 'unread' ? 'false' : '';
      const response = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}${readParam ? `&read=${readParam}`: ''}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch notifications');
      }
      const data = await response.json(); // API returns { notifications: [], unreadCount: number }
      setNotifications(data.notifications || []);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleToggleRead = async (notificationId: string, currentReadStatus: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: !currentReadStatus }),
      });
      if (!response.ok) throw new Error('Failed to update notification status');
      const updatedNotification = await response.json();
      setNotifications(prev => prev.map(n => n.id === notificationId ? updatedNotification : n));
      if (onNotificationUpdate) onNotificationUpdate(); // Refresh bell
    } catch (err: any) {
      setError(err.message || 'Could not update notification.');
    }
  };

  const handleDelete = async (notificationId: string) => {
    // Optimistic UI update
    const originalNotifications = [...notifications];
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete notification');
      // No need to re-fetch, optimistic update is enough
      if (onNotificationUpdate) onNotificationUpdate(); // Refresh bell
    } catch (err: any) {
      setError(err.message || 'Could not delete notification.');
      setNotifications(originalNotifications); // Revert on error
    }
  };

  const handleMarkAllRead = async () => {
    // This would typically be a batch update API endpoint for efficiency
    // For now, iterate and update one by one (less efficient)
    setIsLoading(true);
    const unreadNotifications = notifications.filter(n => !n.read);
    try {
        for (const notification of unreadNotifications) {
            await handleToggleRead(notification.id, false); // Mark as read
        }
        // Re-fetch to ensure UI consistency after multiple updates or rely on individual updates
        fetchNotifications();
    } catch (err: any) {
        setError(err.message || "Failed to mark all as read.");
    } finally {
        setIsLoading(false);
    }
  };


  if (isLoading && notifications.length === 0) { // Show loading only on initial load
    return <div className="p-4 text-center">Loading notifications...</div>;
  }
  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-800 shadow-xl rounded-lg w-full max-w-md md:max-w-lg mx-auto my-4 overflow-hidden">
      <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Notifications</h3>
        <div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
            className="text-sm p-1 border rounded dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
          >
            <option value="unread">Unread</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="p-6 text-center text-zinc-500 dark:text-zinc-400">No {filter === 'unread' ? 'unread ' : ''}notifications.</p>
      ) : (
        <ul className="divide-y dark:divide-zinc-700 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {notifications.map(notification => (
              <motion.li
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 ${notification.read ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-200">{notification.title}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{notification.body}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()} - {new Date(notification.createdAt).toLocaleTimeString()}
                      {notification.triggerAt && ` (Triggers: ${new Date(notification.triggerAt).toLocaleDateString()})`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 space-x-2 ml-2">
                    <button onClick={() => handleToggleRead(notification.id, notification.read)} title={notification.read ? "Mark as Unread" : "Mark as Read"} className="text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400">
                      {notification.read ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                    <button onClick={() => handleDelete(notification.id)} title="Delete Notification" className="text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
       {notifications.filter(n => !n.read).length > 0 && (
         <div className="p-3 border-t dark:border-zinc-700 text-right">
            <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                disabled={isLoading}
            >
                Mark all as read
            </button>
         </div>
       )}
    </div>
  );
};

export default NotificationList;
