'use client';

import { useState, FormEvent, useEffect } from 'react';

interface AddXpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (xpToAdd: number) => Promise<void>; // onSubmit now takes xpToAdd
  skillName: string;
  isLoading?: boolean;
  error?: string | null;
}

export default function AddXpModal({
  isOpen,
  onClose,
  onSubmit,
  skillName,
  isLoading = false,
  error = null,
}: AddXpModalProps) {
  const [xpToAdd, setXpToAdd] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setXpToAdd(0); // Reset when modal opens
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (xpToAdd === 0) { // Allow negative XP for decay/correction later if needed, but 0 is no-op
        // alert("Please enter an XP amount other than 0.");
        // return;
    }
    await onSubmit(xpToAdd);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add XP to: <span className="font-bold">{skillName}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="xpAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">XP Amount to Add</label>
            <input
              type="number"
              name="xpAmount"
              id="xpAmount"
              required
              value={xpToAdd}
              onChange={(e) => setXpToAdd(parseInt(e.target.value, 10) || 0)}
              disabled={isLoading}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          <div className="pt-4 space-x-3 text-right border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isLoading ? 'Adding XP...' : 'Add XP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
