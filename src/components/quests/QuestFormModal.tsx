'use client';

import { useEffect, useState, FormEvent } from 'react';
import { QuestType, QuestDependencyType, QuestStatus } from '@prisma/client'; // Import enums
import { Skill } from '@/app/skills/page'; // Reuse Skill type

// --- Types for Form Data ---
export interface QuestDependencyFormData {
  id?: string; // For existing dependencies during edit
  tempId?: string; // For new dependencies during create/edit before saving
  type: QuestDependencyType;
  description?: string;
  skillId?: string | null;
  targetSkillLevel?: number | null;
  targetSkillXp?: number | null;
  targetDate?: string | null; // Store as ISO string, convert to Date on submit
  // currentProgress?: number; // Usually system-managed, but could be set for MANUAL_CHECK
  isCompleted?: boolean; // For MANUAL_CHECK
}

export interface QuestFormData {
  id?: string; // For edit mode
  name: string;
  description: string;
  type: QuestType;
  status?: QuestStatus; // For edit mode, if status is directly editable
  dependencies: QuestDependencyFormData[];
}

// --- Component Props ---
interface QuestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (questData: QuestFormData) => Promise<void>;
  initialData?: QuestFormData | null;
  mode: 'create' | 'edit';
  userSkills: Skill[]; // To populate skill dropdowns
  isLoading?: boolean;
  error?: string | null;
}

export default function QuestFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  userSkills,
  isLoading = false,
  error = null,
}: QuestFormModalProps) {
  const [formData, setFormData] = useState<QuestFormData>({
    name: '', description: '', type: QuestType.MANUAL, dependencies: [],
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
          ...initialData,
          dependencies: initialData.dependencies.map(d => ({...d, tempId: d.id || crypto.randomUUID()}))
        });
      } else { // Create mode or no initial data
        setFormData({ name: '', description: '', type: QuestType.MANUAL, dependencies: [] });
      }
    }
  }, [isOpen, initialData, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDependencyChange = (tempId: string, field: keyof QuestDependencyFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.map(dep =>
        dep.tempId === tempId ? { ...dep, [field]: value } : dep
      ),
    }));
  };

  const handleDependencyTypeChange = (tempId: string, newType: QuestDependencyType) => {
     setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.map(dep =>
        dep.tempId === tempId ?
        {
            // Reset fields when type changes, keep description if any
            tempId: dep.tempId,
            description: dep.description,
            type: newType,
            skillId: null,
            targetSkillLevel: null,
            targetSkillXp: null,
            targetDate: null,
            isCompleted: false,
        } : dep
      ),
    }));
  };

  const addDependency = () => {
    setFormData(prev => ({
      ...prev,
      dependencies: [
        ...prev.dependencies,
        { tempId: crypto.randomUUID(), type: QuestDependencyType.MANUAL_CHECK, description: '', isCompleted: false }, // Default type
      ],
    }));
  };

  const removeDependency = (tempId: string) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter(dep => dep.tempId !== tempId),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Quest name is required.'); return; }
    // Add more validation as needed

    // Convert targetDate strings to Date objects or ensure API handles ISO strings
    const processedData = {
        ...formData,
        dependencies: formData.dependencies.map(dep => ({
            ...dep,
            targetDate: dep.targetDate ? new Date(dep.targetDate).toISOString() : null,
            // Ensure numeric fields are numbers
            targetSkillLevel: dep.targetSkillLevel ? Number(dep.targetSkillLevel) : null,
            targetSkillXp: dep.targetSkillXp ? Number(dep.targetSkillXp) : null,
        }))
    };
    await onSubmit(processedData);
  };

  if (!isOpen) return null;

  const renderDependencyFields = (dep: QuestDependencyFormData) => {
    switch (dep.type) {
      case QuestDependencyType.SKILL_LEVEL_REACHED:
      case QuestDependencyType.SKILL_XP_GAINED_TOTAL: // Assuming same fields for now
        return (
          <>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">Skill</label>
              <select value={dep.skillId || ''} onChange={(e) => handleDependencyChange(dep.tempId!, 'skillId', e.target.value || null)}
                      className="block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500">
                <option value="">Select Skill</option>
                {userSkills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">{dep.type === QuestDependencyType.SKILL_LEVEL_REACHED ? 'Target Level' : 'Target XP'}</label>
              <input type="number" value={dep.type === QuestDependencyType.SKILL_LEVEL_REACHED ? (dep.targetSkillLevel || '') : (dep.targetSkillXp || '')}
                     onChange={(e) => handleDependencyChange(dep.tempId!, dep.type === QuestDependencyType.SKILL_LEVEL_REACHED ? 'targetSkillLevel' : 'targetSkillXp', parseInt(e.target.value) || null)}
                     className="block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
            </div>
          </>
        );
      case QuestDependencyType.COMPLETE_BY_DATE:
        return (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">Target Date</label>
            <input type="date" value={dep.targetDate ? dep.targetDate.split('T')[0] : ''}
                   onChange={(e) => handleDependencyChange(dep.tempId!, 'targetDate', e.target.value)}
                   className="block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>
        );
      case QuestDependencyType.MANUAL_CHECK: // Description is the main field here
        return (
            <div className="col-span-2">
                {/* Description is handled by the common field */}
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{mode === 'create' ? 'Create New Quest' : 'Edit Quest'}</h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close">X</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

          {/* Main Quest Fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input type="text" name="name" id="name" required value={formData.name} onChange={handleInputChange}
                     className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quest Type</label>
              <select name="type" id="type" value={formData.type} onChange={handleInputChange}
                      className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500">
                {Object.values(QuestType).map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea name="description" id="description" rows={3} value={formData.description} onChange={handleInputChange}
                      className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>

          {/* Dependencies Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dependencies</h3>
            {formData.dependencies.map((dep, index) => (
              <div key={dep.tempId} className="p-3 border border-gray-200 rounded-md dark:border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dependency #{index + 1}</p>
                    <button type="button" onClick={() => removeDependency(dep.tempId!)} className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Remove</button>
                </div>
                <div className="grid grid-cols-1 gap-y-3 gap-x-4 sm:grid-cols-2">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">Type</label>
                        <select value={dep.type} onChange={(e) => handleDependencyTypeChange(dep.tempId!, e.target.value as QuestDependencyType)}
                                className="block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500">
                        {Object.values(QuestDependencyType).map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">Description (Optional)</label>
                        <input type="text" value={dep.description || ''} onChange={(e) => handleDependencyChange(dep.tempId!, 'description', e.target.value)}
                               className="block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"/>
                    </div>
                    {renderDependencyFields(dep)}
                     {dep.type === QuestDependencyType.MANUAL_CHECK && (
                        <div className="flex items-center col-span-2 mt-1">
                            <input type="checkbox" id={`dep-completed-${dep.tempId}`} checked={!!dep.isCompleted} onChange={(e) => handleDependencyChange(dep.tempId!, 'isCompleted', e.target.checked)} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                            <label htmlFor={`dep-completed-${dep.tempId}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">Mark as completed</label>
                        </div>
                    )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addDependency}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-700">
              + Add Dependency
            </button>
          </div>

          <div className="pt-6 space-x-3 text-right border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Quest' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
