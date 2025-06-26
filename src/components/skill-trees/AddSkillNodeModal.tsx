'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Skill } from '@/app/skills/page'; // Reuse Skill type from skills page

// Type for nodes specifically for parent selection
type ParentNodeOption = {
  id: string;
  skillName: string; // To display in the dropdown
};

export interface AddSkillNodeFormData {
  skillId: string;
  parentNodeId: string | null;
  positionX: number;
  positionY: number;
  // metadata could be added here if needed
}

interface AddSkillNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nodeData: AddSkillNodeFormData) => Promise<void>;
  existingSkills: Skill[]; // User's skills to select from
  existingTreeNodes: Array<{ id: string; skill: { name: string } }>; // Nodes in the current tree for parent selection
  isLoading?: boolean;
  error?: string | null;
}

export default function AddSkillNodeModal({
  isOpen,
  onClose,
  onSubmit,
  existingSkills,
  existingTreeNodes,
  isLoading = false,
  error = null,
}: AddSkillNodeModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string | null>(null);
  const [positionX, setPositionX] = useState<number>(50); // Default position
  const [positionY, setPositionY] = useState<number>(50); // Default position

  useEffect(() => {
    // Reset form when modal opens, if it's a fresh open
    if (isOpen) {
      setSelectedSkillId(existingSkills[0]?.id || ''); // Default to first skill or empty
      setSelectedParentNodeId(null);
      setPositionX(50);
      setPositionY(50);
    }
  }, [isOpen, existingSkills]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSkillId) {
      alert('Please select a skill.'); // Basic validation
      return;
    }
    await onSubmit({
      skillId: selectedSkillId,
      parentNodeId: selectedParentNodeId,
      positionX,
      positionY,
    });
  };

  if (!isOpen) return null;

  const parentNodeOptions: ParentNodeOption[] = existingTreeNodes.map(node => ({
    id: node.id,
    skillName: node.skill.name,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Skill to Tree</h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

          <div>
            <label htmlFor="skillId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Skill</label>
            <select
              name="skillId"
              id="skillId"
              required
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              disabled={isLoading || existingSkills.length === 0}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            >
              {existingSkills.length === 0 && <option value="">No skills available</option>}
              {existingSkills.map(skill => (
                <option key={skill.id} value={skill.id}>{skill.name} (Lvl {skill.currentLevel})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="parentNodeId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Parent Node (Optional)</label>
            <select
              name="parentNodeId"
              id="parentNodeId"
              value={selectedParentNodeId || ''}
              onChange={(e) => setSelectedParentNodeId(e.target.value || null)}
              disabled={isLoading || parentNodeOptions.length === 0}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            >
              <option value="">None (Root Node)</option>
              {parentNodeOptions.map(node => (
                <option key={node.id} value={node.id}>{node.skillName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="positionX" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Position X</label>
              <input
                type="number"
                name="positionX"
                id="positionX"
                value={positionX}
                onChange={(e) => setPositionX(parseInt(e.target.value, 10) || 0)}
                disabled={isLoading}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label htmlFor="positionY" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Position Y</label>
              <input
                type="number"
                name="positionY"
                id="positionY"
                value={positionY}
                onChange={(e) => setPositionY(parseInt(e.target.value, 10) || 0)}
                disabled={isLoading}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="pt-4 space-x-3 text-right border-t dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading || existingSkills.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Adding...' : 'Add Node to Tree'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
