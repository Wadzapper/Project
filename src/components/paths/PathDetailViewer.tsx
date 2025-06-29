// src/components/paths/PathDetailViewer.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Skill, Quest } from '@prisma/client'; // Assuming direct prisma types can be used or define more specific ones

// Types based on API responses
export interface PathStepData {
  id: string;
  pathId: string;
  title: string;
  description?: string | null;
  order: number;
  relatedSkillId?: string | null;
  relatedQuestId?: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  relatedSkill?: { id: string; name: string; level?: number } | null;
  relatedQuest?: { id: string; title: string; status?: string } | null;
}

export interface PathDetailData {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; username: string };
  steps: PathStepData[];
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
}

interface PathDetailViewerProps {
  pathId: string;
  initialPathData?: PathDetailData; // Optional initial data to prevent flicker
}

const PathDetailViewer: React.FC<PathDetailViewerProps> = ({ pathId, initialPathData }) => {
  const [path, setPath] = useState<PathDetailData | null>(initialPathData || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPathData);
  const [error, setError] = useState<string | null>(null);

  // State for adding a new step
  const [showAddStepForm, setShowAddStepForm] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDescription, setNewStepDescription] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);

  const fetchPathDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/paths/${pathId}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `Failed to fetch path details: ${response.status}`);
      }
      const data: PathDetailData = await response.json();
      setPath(data);
    } catch (err: any) {
      console.error('Error fetching path details:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    if (!initialPathData) {
      fetchPathDetails();
    }
  }, [fetchPathDetails, initialPathData]);

  const handleToggleStepCompletion = async (stepId: string, currentCompletedStatus: boolean) => {
    if (!path) return;

    const originalSteps = path.steps;
    // Optimistically update UI
    const updatedSteps = path.steps.map(s => s.id === stepId ? { ...s, completed: !currentCompletedStatus } : s);
    const newCompletedSteps = updatedSteps.filter(s => s.completed).length;
    setPath({
        ...path,
        steps: updatedSteps,
        completedSteps: newCompletedSteps,
        progressPercentage: path.totalSteps > 0 ? Math.round((newCompletedSteps / path.totalSteps) * 100) : 0
    });

    try {
      const response = await fetch(`/api/paths/${pathId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompletedStatus }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update step completion.');
      }
      const updatedStepData: PathStepData = await response.json();
      // Update with server response to ensure consistency
      setPath(prevPath => {
        if (!prevPath) return null;
        const finalSteps = prevPath.steps.map(s => s.id === stepId ? updatedStepData : s);
        const finalCompleted = finalSteps.filter(s => s.completed).length;
        return {
            ...prevPath,
            steps: finalSteps,
            completedSteps: finalCompleted,
            progressPercentage: prevPath.totalSteps > 0 ? Math.round((finalCompleted / prevPath.totalSteps) * 100) : 0
        }
      });

    } catch (err: any) {
      console.error('Error toggling step completion:', err);
      setError(err.message || 'Failed to update step.');
      // Revert optimistic update on error
      setPath(prevPath => prevPath ? {...prevPath, steps: originalSteps} : null);
    }
  };

  const handleAddStep = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim() || !path) return;
    setIsAddingStep(true);
    setError(null);

    const newOrder = path.steps.length > 0 ? Math.max(...path.steps.map(s => s.order)) + 1 : 1;

    try {
        const response = await fetch(`/api/paths/${pathId}/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newStepTitle, description: newStepDescription, order: newOrder })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to add step.');
        }
        const addedStep: PathStepData = await response.json();
        setPath(prevPath => prevPath ? ({
            ...prevPath,
            steps: [...prevPath.steps, addedStep].sort((a,b) => a.order - b.order),
            totalSteps: prevPath.totalSteps + 1,
            progressPercentage: (prevPath.totalSteps + 1) > 0 ? Math.round((prevPath.completedSteps / (prevPath.totalSteps + 1)) * 100) : 0

        }) : null);
        setNewStepTitle('');
        setNewStepDescription('');
        setShowAddStepForm(false);
    } catch (err:any) {
        console.error('Error adding step:', err);
        setError(err.message || 'Failed to add step.');
    } finally {
        setIsAddingStep(false);
    }
  };


  if (isLoading) return <div className="text-center p-8">Loading path details...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  if (!path) return <div className="text-center p-8">Path not found.</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-zinc-50 dark:bg-zinc-900 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-100 mb-2" style={{color: path.color || undefined}}>{path.title}</h1>
          {path.description && <p className="text-zinc-600 dark:text-zinc-400 text-lg">{path.description}</p>}
        </header>

        <div className="mb-8 p-4 bg-white dark:bg-zinc-800 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Overall Progress</span>
            <span className="text-sm font-semibold" style={{color: path.color || undefined}}>{path.progressPercentage}%</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-4">
            <motion.div
              className="h-4 rounded-full"
              style={{ backgroundColor: path.color || '#3b82f6' }}
              initial={{ width: 0 }}
              animate={{ width: `${path.progressPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
           <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
                {path.completedSteps} / {path.totalSteps} steps completed
            </p>
        </div>
      </motion.div>

      <div className="mb-6">
        <button
            onClick={() => setShowAddStepForm(!showAddStepForm)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition-colors"
        >
            {showAddStepForm ? 'Cancel Adding Step' : '+ Add New Step'}
        </button>
        <AnimatePresence>
        {showAddStepForm && (
            <motion.form
                onSubmit={handleAddStep}
                className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
            >
                <div className="mb-3">
                    <label htmlFor="newStepTitle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Step Title*</label>
                    <input type="text" id="newStepTitle" value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100" />
                </div>
                <div className="mb-3">
                    <label htmlFor="newStepDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                    <textarea id="newStepDescription" value={newStepDescription} onChange={e => setNewStepDescription(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700 dark:text-zinc-100"></textarea>
                </div>
                 {/* Inputs for relatedSkillId, relatedQuestId could be added here - e.g. dropdowns */}
                <button type="submit" disabled={isAddingStep} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:bg-zinc-400">
                    {isAddingStep ? 'Adding...' : 'Add Step'}
                </button>
            </motion.form>
        )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {path.steps.map((step, index) => (
            <motion.div
              key={step.id}
              layout // Animate layout changes (e.g. when a step is added/removed/reordered)
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
              className={`p-4 rounded-2xl shadow-lg flex items-start gap-4 ${step.completed ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white dark:bg-zinc-800'}`}
            >
              <input
                type="checkbox"
                checked={step.completed}
                onChange={() => handleToggleStepCompletion(step.id, step.completed)}
                className="mt-1 h-5 w-5 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-grow">
                <h4 className={`font-semibold text-lg ${step.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>
                  {step.order}. {step.title}
                </h4>
                {step.description && (
                  <p className={`text-sm mt-1 ${step.completed ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-300'}`}>
                    {step.description}
                  </p>
                )}
                <div className="mt-2 space-x-2 text-xs">
                  {step.relatedSkill && (
                    <Link href={`/skills/${step.relatedSkill.id}`} legacyBehavior>
                      <a className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800">
                        Skill: {step.relatedSkill.name} {step.relatedSkill.level ? `(Lvl ${step.relatedSkill.level})` : ''}
                      </a>
                    </Link>
                  )}
                  {step.relatedQuest && (
                    <Link href={`/quests/${step.relatedQuest.id}`} legacyBehavior>
                      <a className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-800">
                        Quest: {step.relatedQuest.title} {step.relatedQuest.status ? `(${step.relatedQuest.status})` : ''}
                      </a>
                    </Link>
                  )}
                </div>
              </div>
              {/* Placeholder for edit/delete step buttons */}
              {/* <button onClick={() => console.log('Edit step', step.id)} className="text-xs text-blue-500">Edit</button> */}
              {/* <button onClick={() => console.log('Delete step', step.id)} className="text-xs text-red-500">Delete</button> */}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PathDetailViewer;
