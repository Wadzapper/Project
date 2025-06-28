'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlusCircle, ListTree, Loader2 } from 'lucide-react'; // Eye removed, Loader2 added
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import PathList from '@/components/paths/PathList';
import PathDetailViewer from '@/components/paths/PathDetailViewer';
import { PathStepType } from '@prisma/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Define Path types
export interface PathSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: {
    steps: number;
  };
}

interface BasicSkillInfo { id: string; name: string; }
interface BasicQuestInfo { id: string; title: string; }


export default function PathsPage() {
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [isLoadingPaths, setIsLoadingPaths] = useState(true);
  const [errorPaths, setErrorPaths] = useState<string | null>(null);

  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPathName, setNewPathName] = useState('');
  const [newPathDescription, setNewPathDescription] = useState('');
  const [isCreatingPath, setIsCreatingPath] = useState(false);

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
      toast.error(`Failed to load paths: ${err.message}`);
    } finally {
      setIsLoadingPaths(false);
    }
  }, []);

  useEffect(() => {
    fetchPaths();
    const fetchSkillsAndQuests = async () => {
      try {
        const [skillsRes, questsRes] = await Promise.all([
          fetch('/api/skills'),
          fetch('/api/quests?status=ALL'),
        ]);
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          setUserSkillsForPath(skillsData.map((s: any) => ({ id: s.id, name: s.name })));
        } else {
          console.error("Failed to fetch skills for path step adder");
          toast.error("Could not load skills for 'Add Step' form.");
        }
        if (questsRes.ok) {
          const questsData = await questsRes.json();
          setUserQuestsForPath(questsData.map((q: any) => ({ id: q.id, title: q.title || q.name })));
        } else {
          console.error("Failed to fetch quests for path step adder");
          toast.error("Could not load quests for 'Add Step' form.");
        }
      } catch (error) {
        console.error("Error fetching skills/quests for path step adder:", error);
        toast.error("Error fetching resources for 'Add Step' form.");
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
      fetchPaths();
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
      setNewStepType(PathStepType.SKILL);
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
      fetchPaths();
      if (selectedPathId === pathForAddingStep.id) {
        const currentSelected = selectedPathId;
        setSelectedPathId(null);
        setTimeout(() => setSelectedPathId(currentSelected), 0);
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
        <h1 className="text-3xl font-bold flex items-center text-text-primary">
          <ListTree className="mr-3 h-8 w-8 text-accent-primary"/> Learning Paths
        </h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Path
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-bg-card border-border-primary">
            <DialogHeader>
              <DialogTitle className="text-text-primary">Create New Learning Path</DialogTitle>
              <DialogDescription className="text-text-secondary">Define a name and optional description for your new path.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePathSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="new-path-name" className="text-text-secondary">Path Name</Label>
                <Input
                  id="new-path-name"
                  value={newPathName}
                  onChange={(e) => setNewPathName(e.target.value)}
                  placeholder="e.g., Web Development Basics"
                  required
                  className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary"
                />
              </div>
              <div>
                <Label htmlFor="new-path-description" className="text-text-secondary">Description (Optional)</Label>
                <Textarea
                  id="new-path-description"
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
                  placeholder="A brief overview of this learning path"
                  className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreatingPath}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isCreatingPath}>
                  {isCreatingPath ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : 'Create Path'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingPaths && <div className="text-center py-10 text-text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin inline-block"/> Loading paths...</div>}
      {errorPaths && <p className="text-red-500 dark:text-red-400 p-4 bg-red-500/10 border border-red-500/30 rounded-md">Error: {errorPaths}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
          />
        </div>
      </div>

      {pathForAddingStep && (
        <Dialog open={isAddStepModalOpen} onOpenChange={setIsAddStepModalOpen}>
          <DialogContent className="sm:max-w-md bg-bg-card border-border-primary">
            <DialogHeader>
              <DialogTitle className="text-text-primary">Add Step to: {pathForAddingStep.name}</DialogTitle>
              <DialogDescription className="text-text-secondary">Select the type of step and the specific skill or quest.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStepSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="step-type" className="text-text-secondary">Step Type</Label>
                <Select value={newStepType} onValueChange={(value) => setNewStepType(value as PathStepType)}>
                  <SelectTrigger id="step-type" className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                    <SelectItem value={PathStepType.SKILL} className="hover:bg-gray-100 dark:hover:bg-gray-800">Skill</SelectItem>
                    <SelectItem value={PathStepType.QUEST} className="hover:bg-gray-100 dark:hover:bg-gray-800">Quest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newStepType === PathStepType.SKILL && (
                <div>
                  <Label htmlFor="skill-select" className="text-text-secondary">Select Skill</Label>
                  <Select value={selectedSkillIdForStep} onValueChange={setSelectedSkillIdForStep}>
                    <SelectTrigger id="skill-select" className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary"><SelectValue placeholder="Choose a skill..." /></SelectTrigger>
                    <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                      {userSkillsForPath.map(skill => (
                        <SelectItem key={skill.id} value={skill.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">{skill.name}</SelectItem>
                      ))}
                      {userSkillsForPath.length === 0 && <div className="p-2 text-sm text-text-secondary">No skills available.</div>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newStepType === PathStepType.QUEST && (
                <div>
                  <Label htmlFor="quest-select" className="text-text-secondary">Select Quest</Label>
                  <Select value={selectedQuestIdForStep} onValueChange={setSelectedQuestIdForStep}>
                    <SelectTrigger id="quest-select" className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary"><SelectValue placeholder="Choose a quest..." /></SelectTrigger>
                    <SelectContent className="bg-bg-card border-border-primary text-text-primary">
                      {userQuestsForPath.map(quest => (
                        <SelectItem key={quest.id} value={quest.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">{quest.title}</SelectItem>
                      ))}
                      {userQuestsForPath.length === 0 && <div className="p-2 text-sm text-text-secondary">No quests available.</div>}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="step-notes" className="text-text-secondary">Notes (Optional)</Label>
                <Textarea id="step-notes" value={newStepNotes} onChange={(e) => setNewStepNotes(e.target.value)} placeholder="Any notes for this step..." className="mt-1 bg-bg-card border-border-secondary text-text-primary focus:ring-accent-primary" />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isAddingStep}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isAddingStep}>
                  {isAddingStep ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Adding Step...</> : 'Add Step'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
