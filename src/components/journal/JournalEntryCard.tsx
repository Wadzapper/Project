'use client';

import { JournalEntryDisplay } from '@/app/journal/page';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface JournalEntryCardProps {
  entry: JournalEntryDisplay;
  onEdit: (entry: JournalEntryDisplay) => void; // Callback to open edit modal
  onDelete: (entryId: string) => void; // Callback to trigger delete
  // onView: (entry: JournalEntryDisplay) => void; // Callback to open full view modal/page
}

export default function JournalEntryCard({ entry, onEdit, onDelete }: JournalEntryCardProps) {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-2">
        <div className="flex-grow mb-2 sm:mb-0">
          <h2
            className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            onClick={() => onEdit(entry)} // For now, clicking title also opens edit modal
            title={`Edit entry: ${entry.title}`}
          >
            {entry.title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
        <div className="flex space-x-2 flex-shrink-0 self-start sm:self-center">
          <button
            onClick={() => onEdit(entry)}
            className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Edit journal entry: ${entry.title}`}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={`Delete journal entry: ${entry.title}`}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 prose prose-sm dark:prose-invert max-w-none line-clamp-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {entry.content}
        </ReactMarkdown>
      </div>

      {entry.tags && entry.tags.length > 0 && (
        <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          {entry.tags.map(tag => (
            <span
              key={tag}
              className="mr-2 mb-1 inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full dark:bg-gray-700 dark:text-gray-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
