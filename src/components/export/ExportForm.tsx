// src/components/export/ExportForm.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';

const ExportForm = () => {
  // userId will be used for the API request. In a real app, this would come from auth context.
  const [userId, setUserId] = useState<string>('demo-user'); // Default to demo-user for now
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (!userId.trim()) {
      setError('User ID is required. Please enter a User ID.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        throw new Error(errorData.message || `Export failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `${userId}_export_all_data.zip`; // Default filename for ZIP

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
        if (fileNameMatch && fileNameMatch.length > 1) {
          fileName = fileNameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage(`Export successful! File '${fileName}' should be downloading.`);

    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'An unexpected error occurred during export.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white dark:bg-zinc-800 p-6 md:p-8 rounded-2xl shadow-lg max-w-md mx-auto"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-center text-zinc-800 dark:text-zinc-100">
          Download Your Data Archive
        </h2>

        {/* UserID input - can be hidden or removed if userId comes from auth context */}
        <div>
          <label htmlFor="userIdExport" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            User ID (e.g., "demo-user"):
          </label>
          <input
            type="text"
            id="userIdExport"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            required
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
          This will download a .zip file containing all your data in CSV format.
        </p>

        <motion.button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          whileHover={{ scale: isLoading ? 1 : 1.03 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            'Download My Data Archive (ZIP)'
          )}
        </motion.button>

        {message && <p className="text-green-600 dark:text-green-400 text-sm text-center">{message}</p>}
        {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">Error: {error}</p>}
      </form>
    </motion.div>
  );
};

export default ExportForm;
