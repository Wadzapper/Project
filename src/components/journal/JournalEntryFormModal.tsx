'use client';

import { useEffect, useState, FormEvent } from 'react';
import toast from 'react-hot-toast';

// Data structure for the form
export interface JournalEntryFormData {
  id?: string; // Present if editing
  title: string;
  content: string;
  date: string; // ISO date string (e.g., YYYY-MM-DD)
  tags: string[]; // Array of strings
  // Optional linked IDs - for MVP, we might not have UI to edit these directly in this modal
  linkedSkillIds?: string[];
  linkedQuestIds?: string[];
  linkedAchievementIds?: string[];
}

interface JournalEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entryData: JournalEntryFormData) => Promise<void>;
  initialData?: JournalEntryFormData | null;
  mode: 'create' | 'edit';
  isLoading?: boolean;
  error?: string | null; // Error from submission
}

export default function JournalEntryFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null,
}: JournalEntryFormModalProps) {

  const defaultDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const [formData, setFormData] = useState<JournalEntryFormData>({
    title: '',
    content: '',
    date: defaultDate,
    tags: [],
    ...initialData,
  });
  const [tagsInput, setTagsInput] = useState(''); // For comma-separated input

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
            id: initialData.id,
            title: initialData.title || '',
            content: initialData.content || '',
            date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : defaultDate,
            tags: initialData.tags || [],
            linkedSkillIds: initialData.linkedSkillIds || [],
            linkedQuestIds: initialData.linkedQuestIds || [],
            linkedAchievementIds: initialData.linkedAchievementIds || [],
        });
        setTagsInput((initialData.tags || []).join(', '));
      } else { // Create mode or no initial data
        setFormData({ title: '', content: '', date: defaultDate, tags: [] });
        setTagsInput('');
      }
    }
  }, [isOpen, initialData, mode, defaultDate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
    // Update formData.tags immediately or on blur/submit
    const newTags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('Content cannot be empty.');
      return;
    }
    // Ensure tags are up-to-date from tagsInput before submitting
    const finalTags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    await onSubmit({ ...formData, tags: finalTags });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Create New Journal Entry' : 'Edit Journal Entry'}
          </h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input type="text" name="title" id="title" required value={formData.title} onChange={handleInputChange} disabled={isLoading}
                   className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
            <input type="date" name="date" id="date" required value={formData.date} onChange={handleInputChange} disabled={isLoading}
                   className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Markdown supported)</label>
            <textarea name="content" id="content" rows={10} value={formData.content} onChange={handleInputChange} disabled={isLoading}
                      className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma-separated)</label>
            <input type="text" name="tags" id="tags" value={tagsInput} onChange={handleTagsChange} disabled={isLoading}
                   className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>

          {/* Placeholder for linking UI - for later */}
          {/*
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Link to (Optional):</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Linking UI to be implemented.</p>
          </div>
          */}

          <div className="pt-4 space-x-3 text-right border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Entry' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
