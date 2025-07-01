// src/app/notifications/page.tsx
'use client'; // This page will involve client-side interactions (fetching, forms)

import React from 'react';
import NotificationList from '@/components/notifications/NotificationList';
import NotificationCreator from '@/components/notifications/NotificationCreator';
import { motion } from 'framer-motion';

// This page would ideally get userId from an authentication context/session.
// For now, using a placeholder.
const PLACEHOLDER_USER_ID = "demo-user";

export default function NotificationsPage() {
  // The NotificationBell might live in a global layout, so its onNotificationUpdate
  // might need to be managed by a global state or context to refresh other components.
  // For this page, we can pass a dummy or simple re-fetch trigger if needed.
  const handleNotificationUpdate = () => {
    // This function could trigger a re-fetch in NotificationList if it doesn't do it internally,
    // or update a global unread count if NotificationBell is also on this page (which it typically wouldn't be).
    console.log("Notification list or bell might need an update.");
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <motion.header
        className="mb-8 md:mb-12 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-800 dark:text-zinc-100">
          Your Notifications
        </h1>
        <p className="text-md sm:text-lg text-zinc-600 dark:text-zinc-400 mt-2">
          Stay updated with reminders and alerts.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-2xl font-semibold text-zinc-700 dark:text-zinc-200 mb-4">Inbox</h2>
          <NotificationList
            userId={PLACEHOLDER_USER_ID}
            onNotificationUpdate={handleNotificationUpdate}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold text-zinc-700 dark:text-zinc-200 mb-4">Schedule Reminder</h2>
          <NotificationCreator
            userId={PLACEHOLDER_USER_ID}
            onNotificationCreated={handleNotificationUpdate}
          />
        </motion.div>
      </div>
    </div>
  );
}
