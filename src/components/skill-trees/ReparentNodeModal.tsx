'use client';

import { useEffect, useState, FormEvent } from 'react';

type ParentNodeOption = {
  id: string;
  skillName: string;
};

interface ReparentNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newParentNodeId: string | null) => Promise<void>;
  currentNodeId: string; // To prevent selecting self as parent
  existingTreeNodes: Array<{ id: string; skill: { name: string } }>; // Nodes in the current tree for parent selection
  currentParentNodeId: string | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function ReparentNodeModal({
  isOpen,
  onClose,
  onSubmit,
  currentNodeId,
  existingTreeNodes,
  currentParentNodeId,
  isLoading = false,
  error = null,
}: ReparentNodeModalProps) {
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedParentNodeId(currentParentNodeId);
    }
  }, [isOpen, currentParentNodeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(selectedParentNodeId);
  };

  if (!isOpen) return null;

  const parentNodeOptions: ParentNodeOption[] = existingTreeNodes
    .filter(node => node.id !== currentNodeId) // Cannot parent to self
    .map(node => ({
      id: node.id,
      skillName: node.skill.name,
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Change Parent Node</h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

          <div>
            <label htmlFor="parentNodeIdReparent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select New Parent Node (Optional)</label>
            <select
              name="parentNodeIdReparent"
              id="parentNodeIdReparent"
              value={selectedParentNodeId || ''}
              onChange={(e) => setSelectedParentNodeId(e.target.value || null)}
              disabled={isLoading || parentNodeOptions.length === 0}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            >
              <option value="">None (Make Root Node)</option>
              {parentNodeOptions.map(node => (
                <option key={node.id} value={node.id}>{node.skillName}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 space-x-3 text-right border-t dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Saving...' : 'Set Parent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
