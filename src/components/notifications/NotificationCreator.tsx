// src/components/notifications/NotificationCreator.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';

interface NotificationCreatorProps {
  userId: string; // Or from auth context
  onNotificationCreated?: () => void; // Optional callback to refresh lists etc.
}

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ userId, onNotificationCreated }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [triggerAtDate, setTriggerAtDate] = useState(''); // Store date as YYYY-MM-DD
  const [triggerAtTime, setTriggerAtTime] = useState(''); // Store time as HH:MM

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!title.trim() || !body.trim() || !triggerAtDate || !triggerAtTime) {
      setError('Title, body, trigger date, and trigger time are required.');
      setIsLoading(false);
      return;
    }

    const triggerAtDateTime = new Date(`${triggerAtDate}T${triggerAtTime}`);
    if (isNaN(triggerAtDateTime.getTime())) {
        setError('Invalid date or time format for trigger.');
        setIsLoading(false);
        return;
    }
    if (triggerAtDateTime <= new Date()) {
        setError('Trigger date and time must be in the future.');
        setIsLoading(false);
        return;
    }

    const payload = {
      userId,
      type: 'reminder', // Explicitly for manual reminders
      title,
      body,
      triggerAt: triggerAtDateTime.toISOString(),
      // relatedId can be null for general reminders
    };

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create notification.');
      }

      setSuccessMessage('Reminder scheduled successfully!');
      setTitle('');
      setBody('');
      setTriggerAtDate('');
      setTriggerAtTime('');
      if (onNotificationCreated) {
        onNotificationCreated();
      }
    } catch (err: any) {
      console.error('Error creating notification:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get current date in YYYY-MM-DD format for min attribute of date input
  const today = new Date().toISOString().split('T')[0];


  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg max-w-lg mx-auto my-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4">Schedule a Reminder</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nc-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title*</label>
          <input
            type="text"
            id="nc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="nc-body" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Body/Message*</label>
          <textarea
            id="nc-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="nc-triggerdate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Trigger Date*</label>
                <input
                    type="date"
                    id="nc-triggerdate"
                    value={triggerAtDate}
                    onChange={(e) => setTriggerAtDate(e.target.value)}
                    min={today}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100"
                />
            </div>
            <div>
                <label htmlFor="nc-triggertime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Trigger Time*</label>
                <input
                    type="time"
                    id="nc-triggertime"
                    value={triggerAtTime}
                    onChange={(e) => setTriggerAtTime(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100"
                />
            </div>
        </div>

        <motion.button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          {isLoading ? 'Scheduling...' : 'Schedule Reminder'}
        </motion.button>

        {successMessage && <p className="text-green-600 dark:text-green-400 text-sm text-center mt-2">{successMessage}</p>}
        {error && <p className="text-red-600 dark:text-red-400 text-sm text-center mt-2">Error: {error}</p>}
      </form>
    </motion.div>
  );
};

export default NotificationCreator;
