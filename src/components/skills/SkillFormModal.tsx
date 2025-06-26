'use client';

import { useEffect, useState, FormEvent } from 'react';

// Define the structure of a skill for form handling
export interface SkillFormData {
  id?: string; // Present if editing
  name: string;
  description: string;
  currentLevel: number;
  currentXp: number;
  targetXpForNextLevel: number;
}

interface SkillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (skillData: SkillFormData) => Promise<void>; // Returns promise for async handling
  initialData?: SkillFormData | null; // For pre-filling form in edit mode
  mode: 'create' | 'edit';
  isLoading?: boolean; // To show loading state on submit button
  error?: string | null; // To display submission errors
}

export default function SkillFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null,
}: SkillFormModalProps) {
  const [skillData, setSkillData] = useState<SkillFormData>({
    name: '',
    description: '',
    currentLevel: 1,
    currentXp: 0,
    targetXpForNextLevel: 100,
    ...initialData // Spread initialData to overwrite defaults if provided
  });

  // Effect to update form when initialData changes (e.g., when opening modal for editing)
  useEffect(() => {
    if (initialData) {
      setSkillData({ ...initialData });
    } else {
      // Reset to defaults for create mode or if initialData is cleared
      setSkillData({
        name: '',
        description: '',
        currentLevel: 1,
        currentXp: 0,
        targetXpForNextLevel: 100,
      });
    }
  }, [initialData, mode]); // Depend on mode as well to reset if switching from edit to create

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setSkillData((prevData) => ({
      ...prevData,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Basic client-side validation
    if (!skillData.name.trim()) {
      // Ideally, set a local error state for the form field
      alert('Skill name is required.');
      return;
    }
    await onSubmit(skillData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Add New Skill' : 'Edit Skill'}
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              type="text"
              name="name"
              id="name"
              required
              value={skillData.name}
              onChange={handleChange}
              disabled={isLoading}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              name="description"
              id="description"
              rows={3}
              value={skillData.description}
              onChange={handleChange}
              disabled={isLoading}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="currentLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
              <input
                type="number"
                name="currentLevel"
                id="currentLevel"
                value={skillData.currentLevel}
                onChange={handleChange}
                disabled={isLoading || mode === 'create'} // Level 1 for create, editable for edit
                className="block w-full px-3 py-2 mt-1 disabled:bg-gray-100 dark:disabled:bg-gray-700/50"
              />
            </div>
            <div>
              <label htmlFor="currentXp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">XP</label>
              <input
                type="number"
                name="currentXp"
                id="currentXp"
                value={skillData.currentXp}
                onChange={handleChange}
                disabled={isLoading || mode === 'create'} // XP 0 for create, editable for edit
                className="block w-full px-3 py-2 mt-1 disabled:bg-gray-100 dark:disabled:bg-gray-700/50"
              />
            </div>
            <div>
              <label htmlFor="targetXpForNextLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Next Level XP</label>
              <input
                type="number"
                name="targetXpForNextLevel"
                id="targetXpForNextLevel"
                value={skillData.targetXpForNextLevel}
                onChange={handleChange}
                disabled={isLoading} // Editable for both modes, but defaults for create
                className="block w-full px-3 py-2 mt-1"
              />
            </div>
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
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Skill' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
