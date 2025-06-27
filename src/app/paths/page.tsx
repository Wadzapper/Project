'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlusCircle, ListTree, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog'; // For modal

// Define Path types (mirroring Prisma schema outputs, simplified for list)
export interface PathSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: {
    steps: number;
  };
import PathList from '@/components/paths/PathList'; // Import the actual PathList component

import PathDetailViewer from '@/components/paths/PathDetailViewer'; // Import the actual PathDetailViewer
import { PathStepType } from '@prisma/client'; // For Add Step form
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // For Add Step form

// Types for skills and quests needed for the "Add Step" form
// These should ideally come from a shared types definition or their respective page/API modules
interface BasicSkillInfo { id: string; name: string; }
interface BasicQuestInfo { id: string; title: string; } // Using 'title' as per Quest API response for path steps

// const PathDetailViewerPlaceholder = ... (This will be removed)


export default function PathsPage() {
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [isLoadingPaths, setIsLoadingPaths] = useState(true);
  const [errorPaths, setErrorPaths] = useState<string | null>(null);

  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // State for "Create New Path" modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPathName, setNewPathName] = useState('');
  const [newPathDescription, setNewPathDescription] = useState('');
  const [isCreatingPath, setIsCreatingPath] = useState(false);

  // State for "Add Step to Path" modal
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [pathForAddingStep, setPathForAddingStep] = useState<PathSummary | null>(null);
  const [userSkillsForPath, setUserSkillsForPath] = useState<BasicSkillInfo[]>([]);
  const [userQuestsForPath, setUserQuestsForPath] = useState<BasicQuestInfo[]>([]);
  const [newStepType, setNewStepType] = useState<PathStepType>(PathStepType.SKILL);
  const [selectedSkillIdForStep, setSelectedSkillIdForStep] = useState<string>('');
  const [selectedQuestIdForStep, setSelectedQuestIdForStep] = useState<string>('');
  const [newStepNotes, setNewStepNotes] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);


  const fetchPaths = useCallback(async () => {
    setIsLoadingPaths(true);
    setErrorPaths(null);
    try {
      const response = await fetch('/api/paths');
      if (!response.ok) throw new Error('Failed to fetch paths');
      const data: PathSummary[] = await response.json();
      setPaths(data);
    } catch (err: any) {
      setErrorPaths(err.message);
      toast.error(err.message);
    } finally {
      setIsLoadingPaths(false);
    }
  }, []);

  useEffect(() => {
    fetchPaths();
    // Fetch skills and quests for the "Add Step" modal
    const fetchSkillsAndQuests = async () => {
      try {
        const [skillsRes, questsRes] = await Promise.all([
          fetch('/api/skills'), // Fetches all skills of the user
          fetch('/api/quests?status=ALL'), // Fetch all quests (or non-archived/non-completed)
        ]);
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          setUserSkillsForPath(skillsData.map((s: any) => ({ id: s.id, name: s.name })));
        } else {
          console.error("Failed to fetch skills for path step adder");
        }
        if (questsRes.ok) {
          const questsData = await questsRes.json();
          // Assuming questsData items have 'id' and 'title' or 'name'
          setUserQuestsForPath(questsData.map((q: any) => ({ id: q.id, title: q.title || q.name })));
        } else {
          console.error("Failed to fetch quests for path step adder");
        }
      } catch (error) {
        console.error("Error fetching skills/quests for path step adder:", error);
      }
    };
    fetchSkillsAndQuests();
  }, [fetchPaths]);

  const handleCreatePathSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPathName.trim()) {
      toast.error('Path name is required.');
      return;
    }
    setIsCreatingPath(true);
    try {
      const response = await fetch('/api/paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPathName, description: newPathDescription }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create path.');
      }
      toast.success('Path created successfully!');
      setNewPathName('');
      setNewPathDescription('');
      setIsCreateModalOpen(false);
      fetchPaths(); // Refresh path list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingPath(false);
    }
  };

  const handleSelectPath = (pathId: string) => {
    setSelectedPathId(pathId);
  };

  const handleTriggerAddStep = (pathToAddToId: string) => {
    const pathMeta = paths.find(p => p.id === pathToAddToId);
    if (pathMeta) {
      setPathForAddingStep(pathMeta);
      setNewStepType(PathStepType.SKILL); // Default to SKILL
      setSelectedSkillIdForStep('');
      setSelectedQuestIdForStep('');
      setNewStepNotes('');
      setIsAddStepModalOpen(true);
    }
  };

  const handleAddStepSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pathForAddingStep) return;

    let stepItemId: string | undefined;
    if (newStepType === PathStepType.SKILL) {
      if (!selectedSkillIdForStep) { toast.error("Please select a skill."); return; }
      stepItemId = selectedSkillIdForStep;
    } else if (newStepType === PathStepType.QUEST) {
      if (!selectedQuestIdForStep) { toast.error("Please select a quest."); return; }
      stepItemId = selectedQuestIdForStep;
    } else {
      toast.error("Invalid step type."); return;
    }

    setIsAddingStep(true);
    try {
      const payload = {
        type: newStepType,
        skillId: newStepType === PathStepType.SKILL ? stepItemId : null,
        questId: newStepType === PathStepType.QUEST ? stepItemId : null,
        notes: newStepNotes.trim() || null,
        // Order will be handled by API (appended)
      };
      const response = await fetch(`/api/paths/${pathForAddingStep.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add step.');
      }
      toast.success('Step added successfully!');
      setIsAddStepModalOpen(false);
      // To refresh the PathDetailViewer, we need it to refetch.
      // A simple way is to change its key or trigger its internal fetch.
      // For now, if selectedPathId is the one we added to, setting it again might trigger its useEffect.
      // Or, PathDetailViewer needs an onStepUpdate prop that PathPage can call to trigger its fetch.
      // Let's assume PathDetailViewer's useEffect on pathId will refetch.
      // If PathList's step count needs update, fetchPaths() is needed.
      fetchPaths(); // This will update step counts in PathList
      if (selectedPathId === pathForAddingStep.id) {
        // Force re-render/refetch of PathDetailViewer if it's already showing this path
        // This is a bit of a hack; ideally PathDetailViewer would have a refresh prop/function
        const currentSelected = selectedPathId;
        setSelectedPathId(null); // Briefly deselect
        setTimeout(() => setSelectedPathId(currentSelected), 0); // Reselect
      }

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAddingStep(false);
    }
  };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold flex items-center"><ListTree className="mr-3 h-8 w-8 text-primary"/> Learning Paths</h1>
        {/* Create Path Dialog */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          {/* ... (Create Path Dialog content - unchanged) ... */}
           <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Path
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Learning Path</DialogTitle>
              <DialogDescription>Define a name and optional description for your new path.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePathSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="new-path-name">Path Name</Label>
                <Input
                  id="new-path-name"
                  value={newPathName}
                  onChange={(e) => setNewPathName(e.target.value)}
                  placeholder="e.g., Web Development Basics"
                  required
                />
              </div>
              <div>
                <Label htmlFor="new-path-description">Description (Optional)</Label>
                <Textarea
                  id="new-path-description"
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
                  placeholder="A brief overview of this learning path"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreatingPath}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isCreatingPath}>
                  {isCreatingPath ? 'Creating...' : 'Create Path'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingPaths && <p className="text-muted-foreground">Loading paths...</p>}
      {errorPaths && <p className="text-red-500">Error: {errorPaths}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <PathList
            paths={paths}
            onSelectPath={handleSelectPath}
            selectedPathId={selectedPathId}
            isLoading={isLoadingPaths}
          />
        </div>
        <div className="md:col-span-2">
          <PathDetailViewer
            pathId={selectedPathId}
            onTriggerAddStep={handleTriggerAddStep}
            // onStepUpdate={() => { /* Logic to refresh PathDetailViewer if needed, e.g. if it doesn't refetch on its own on prop change */ }}
          />
        </div>
      </div>

      {/* Add Step Dialog */}
      {pathForAddingStep && (
        <Dialog open={isAddStepModalOpen} onOpenChange={setIsAddStepModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Step to: {pathForAddingStep.name}</DialogTitle>
              <DialogDescription>Select the type of step and the specific skill or quest.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStepSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="step-type">Step Type</Label>
                <Select value={newStepType} onValueChange={(value) => setNewStepType(value as PathStepType)}>
                  <SelectTrigger id="step-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PathStepType.SKILL}>Skill</SelectItem>
                    <SelectItem value={PathStepType.QUEST}>Quest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newStepType === PathStepType.SKILL && (
                <div>
                  <Label htmlFor="skill-select">Select Skill</Label>
                  <Select value={selectedSkillIdForStep} onValueChange={setSelectedSkillIdForStep}>
                    <SelectTrigger id="skill-select"><SelectValue placeholder="Choose a skill..." /></SelectTrigger>
                    <SelectContent>
                      {userSkillsForPath.map(skill => (
                        <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>
                      ))}
                      {userSkillsForPath.length === 0 && <div className="p-2 text-sm text-muted-foreground">No skills available.</div>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newStepType === PathStepType.QUEST && (
                <div>
                  <Label htmlFor="quest-select">Select Quest</Label>
                  <Select value={selectedQuestIdForStep} onValueChange={setSelectedQuestIdForStep}>
                    <SelectTrigger id="quest-select"><SelectValue placeholder="Choose a quest..." /></SelectTrigger>
                    <SelectContent>
                      {userQuestsForPath.map(quest => (
                        <SelectItem key={quest.id} value={quest.id}>{quest.title}</SelectItem>
                      ))}
                      {userQuestsForPath.length === 0 && <div className="p-2 text-sm text-muted-foreground">No quests available.</div>}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="step-notes">Notes (Optional)</Label>
                <Textarea id="step-notes" value={newStepNotes} onChange={(e) => setNewStepNotes(e.target.value)} placeholder="Any notes for this step..." />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isAddingStep}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isAddingStep}>
                  {isAddingStep ? 'Adding Step...' : 'Add Step'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
