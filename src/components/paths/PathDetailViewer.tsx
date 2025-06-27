'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PathStepType, QuestStatus } from '@prisma/client'; // Assuming these enums
import { AlertTriangle, CheckCircle2, Circle, Edit, PlusCircle, BookOpen, ShieldQuestion, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Define the detailed Path structure expected from API /api/paths/[pathId]
interface SkillForStep {
  id: string;
  name: string;
  currentLevel?: number; // Optional, from include
}
interface QuestForStep {
  id: string;
  title: string;
  status?: QuestStatus; // Optional, from include
}
export interface PathStepDetail {
  id: string;
  order: number;
  type: PathStepType;
  skillId?: string | null;
  questId?: string | null;
  skill?: SkillForStep | null;
  quest?: QuestForStep | null;
  completed: boolean;
  notes?: string | null;
}
export interface PathDetail {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  steps: PathStepDetail[];
}

interface PathDetailViewerProps {
  pathId: string | null;
  onStepUpdate?: () => void; // Callback to refresh path list if step completion might affect overall path status
  // Placeholder for adding a step - will be replaced by PathStepAdder component/modal
  onTriggerAddStep?: (pathId: string) => void;
}

const PathDetailViewer: React.FC<PathDetailViewerProps> = ({ pathId, onStepUpdate, onTriggerAddStep }) => {
  const [pathDetails, setPathDetails] = useState<PathDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPathDetails = useCallback(async () => {
    if (!pathId) {
      setPathDetails(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/paths/${pathId}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch path details.');
      }
      const data: PathDetail = await response.json();
      setPathDetails(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    fetchPathDetails();
  }, [fetchPathDetails]);

  const handleToggleStepCompletion = async (stepId: string, currentCompletedStatus: boolean) => {
    if (!pathId) return;
    // Optimistic update placeholder (can be more complex)
    // setPathDetails(prev => ... update step locally ...);

    try {
      const response = await fetch(`/api/paths/${pathId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompletedStatus }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update step status.');
      }
      toast.success(`Step marked as ${!currentCompletedStatus ? 'complete' : 'incomplete'}.`);
      fetchPathDetails(); // Refetch to get the latest state
      if (onStepUpdate) onStepUpdate();
    } catch (err: any) {
      toast.error(err.message);
      // Revert optimistic update if implemented
    }
  };

  if (!pathId) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted/30">
        <CardContent className="text-center text-muted-foreground p-6">
          <Eye className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Select a path from the list to view its details and steps.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading path details...</div>;
  if (error) return <div className="p-6 text-center text-red-500 flex flex-col items-center"><AlertTriangle className="w-8 h-8 mb-2" />Error: {error}</div>;
  if (!pathDetails) return <div className="p-6 text-center text-muted-foreground">Path details not found.</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">{pathDetails.name}</CardTitle>
            {onTriggerAddStep && (
                 <Button variant="outline" size="sm" onClick={() => onTriggerAddStep(pathDetails.id)}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Step
                </Button>
            )}
        </div>
        {pathDetails.description && <CardDescription className="mt-1">{pathDetails.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <h4 className="text-md font-semibold mb-3 mt-2">Steps:</h4>
        {pathDetails.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">This path has no steps yet. Click "Add Step" to begin.</p>
        ) : (
          <ul className="space-y-3">
            {pathDetails.steps.map((step, index) => (
              <li key={step.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/40 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-mono ${step.completed ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                  {step.type === PathStepType.SKILL && <BookOpen className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                  {step.type === PathStepType.QUEST && <ShieldQuestion className="h-5 w-5 text-purple-500 flex-shrink-0" />}
                  <div>
                    <span className="font-medium text-sm">
                      {step.type === PathStepType.SKILL ? step.skill?.name || 'Skill (Not Found)' : step.quest?.title || 'Quest (Not Found)'}
                    </span>
                    {step.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{step.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Placeholder for edit step notes button */}
                  {/* <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3.5 w-3.5"/></Button> */}
                  <Checkbox
                    id={`step-${step.id}`}
                    checked={step.completed}
                    onCheckedChange={() => handleToggleStepCompletion(step.id, step.completed)}
                    aria-labelledby={`step-label-${step.id}`}
                  />
                   <Label htmlFor={`step-${step.id}`} id={`step-label-${step.id}`} className="text-xs cursor-pointer select-none">
                     {step.completed ? 'Completed' : 'Mark Done'}
                   </Label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default PathDetailViewer;
