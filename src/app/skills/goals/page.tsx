// Summary: Page for viewing and managing Skill Goals.
// TODO: Implement Edit/Delete functionality for individual goals.
// TODO: Add filtering options (e.g., show completed, filter by skill).
// TODO: Refine date formatting and progress bar appearance.

'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlusCircle, Target, CheckCircle2, XCircle, CalendarClock, Edit2, Trash2, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import ProgressBar from '@/components/ui/ProgressBar'; // Assuming this component exists
import { Skill, SkillGoal } from '@prisma/client'; // Assuming Prisma types
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';


// Define the structure for SkillGoal with included Skill details
interface SkillGoalWithSkill extends SkillGoal {
  skill: Pick<Skill, 'id' | 'name' | 'currentXp' | 'currentLevel'>;
}

// For the "Add Goal" form
interface SkillGoalFormData {
  skillId: string;
  targetXP: string; // Input as string
  dueDate?: string;  // Input as string (YYYY-MM-DD)
  notes?: string;
}

const SkillGoalsPage = () => {
  const router = useRouter();
  const [skillGoals, setSkillGoals] = useState<SkillGoalWithSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean | null>(false);
  const [prevSkillGoals, setPrevSkillGoals] = useState<SkillGoalWithSkill[]>([]); // To track changes for confetti

  // For "Add New Goal" modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userSkills, setUserSkills] = useState<Pick<Skill, 'id' | 'name'>[]>([]);
  const [newGoalForm, setNewGoalForm] = useState<SkillGoalFormData>({
    skillId: '',
    targetXP: '',
    dueDate: '',
    notes: '',
  });
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);

  const fetchSkillGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    let url = '/api/skill-goals';
    if (filterCompleted === true) url += '?isComplete=true';
    else if (filterCompleted === false) url += '?isComplete=false';
    // If filterCompleted is null, no query param, API returns all.

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch skill goals.');
      }
      const newGoalsData: SkillGoalWithSkill[] = await response.json();

      // Check for newly completed goals for confetti
      if (prevSkillGoals.length > 0) {
        newGoalsData.forEach(newGoal => {
          const oldGoal = prevSkillGoals.find(og => og.id === newGoal.id);
          if (newGoal.isComplete && (!oldGoal || !oldGoal.isComplete)) {
            // Trigger confetti!
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#22c55e', '#10b981', '#f59e0b'] });
          }
        });
      }
      setPrevSkillGoals(skillGoals); // Store current goals as previous for next fetch
      setSkillGoals(newGoalsData);

    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filterCompleted]);

  const fetchUserSkills = useCallback(async () => {
    try {
      const response = await fetch('/api/skills'); // Fetches all user skills
      if (!response.ok) throw new Error('Failed to fetch user skills for goal form');
      const data: Skill[] = await response.json();
      setUserSkills(data.map(s => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error("Error fetching skills for goal form:", error);
      toast.error("Could not load skills for goal creation.");
    }
  }, []);

  useEffect(() => {
    fetchSkillGoals();
  }, [fetchSkillGoals]);

  useEffect(() => {
    if (isAddModalOpen) {
      fetchUserSkills(); // Fetch/refresh skills when modal opens
    }
  }, [isAddModalOpen, fetchUserSkills]);

  const handleAddGoalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewGoalForm(prev => ({ ...prev, [name]: value }));
  };
   const handleAddGoalSelectChange = (name: keyof SkillGoalFormData, value: string) => {
    setNewGoalForm(prev => ({ ...prev, [name]: value }));
  };


  const handleAddGoalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGoalForm.skillId) { toast.error("Please select a skill."); return; }
    const targetXPNum = parseInt(newGoalForm.targetXP, 10);
    if (isNaN(targetXPNum) || targetXPNum <= 0) { toast.error("Target XP must be a positive number."); return; }

    setIsSubmittingGoal(true);
    try {
      const payload = {
        skillId: newGoalForm.skillId,
        targetXP: targetXPNum,
        dueDate: newGoalForm.dueDate || null,
        notes: newGoalForm.notes || null,
      };
      const response = await fetch('/api/skill-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create skill goal.');
      }
      const createdGoal: SkillGoalWithSkill = await response.json();
      toast.success('Skill goal created successfully!');
      if (createdGoal.isComplete) {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#22c55e', '#10b981', '#f59e0b'] });
      }
      setNewGoalForm({ skillId: '', targetXP: '', dueDate: '', notes: '' }); // Reset form
      setIsAddModalOpen(false);
      fetchSkillGoals(); // Refresh list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
      if (!window.confirm("Are you sure you want to delete this skill goal?")) return;
      toast.loading("Deleting goal...");
      try {
        const response = await fetch(`/api/skill-goals/${goalId}`, {method: 'DELETE'});
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to delete goal.");
        }
        toast.dismiss();
        toast.success("Skill goal deleted.");
        fetchSkillGoals();
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message);
      }
  };


  const formatDueDate = (dateString?: string | null | Date) => {
    if (!dateString) return 'No due date';
    return format(parseISO(dateString as string), 'MMM d, yyyy');
  };

  const getProgressPercent = (currentXp: number, targetXP: number): number => {
    if (targetXP <= 0) return 0;
    const progress = (currentXp / targetXP) * 100;
    return Math.min(100, Math.max(0, progress)); // Clamp between 0 and 100
  };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
         <Button variant="outline" size="sm" onClick={() => router.back()} className="sm:hidden mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center"><Target className="mr-3 h-8 w-8 text-primary"/> Skill Goals</h1>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-5 w-5" /> Add New Goal</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set New Skill Goal</DialogTitle>
              <DialogDescription>Define a target XP for one of your skills.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddGoalSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="skillId">Skill</Label>
                <Select name="skillId" value={newGoalForm.skillId} onValueChange={(value) => handleAddGoalSelectChange('skillId', value)}>
                  <SelectTrigger id="skillId"><SelectValue placeholder="Select a skill..." /></SelectTrigger>
                  <SelectContent>
                    {userSkills.length > 0 ? userSkills.map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>
                    )) : <div className="p-2 text-sm text-muted-foreground">No skills found.</div>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetXP">Target XP</Label>
                <Input id="targetXP" name="targetXP" type="number" value={newGoalForm.targetXP} onChange={handleAddGoalInputChange} placeholder="e.g., 1000" required min="1"/>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input id="dueDate" name="dueDate" type="date" value={newGoalForm.dueDate} onChange={handleAddGoalInputChange} />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" name="notes" value={newGoalForm.notes} onChange={handleAddGoalInputChange} placeholder="Specific focus or reason for this goal..." />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingGoal}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingGoal}>
                  {isSubmittingGoal ? 'Adding Goal...' : 'Add Goal'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Buttons */}
      <div className="mb-4 flex space-x-2">
        <Button variant={filterCompleted === false ? "default" : "outline"} size="sm" onClick={() => setFilterCompleted(false)}>Incomplete</Button>
        <Button variant={filterCompleted === true ? "default" : "outline"} size="sm" onClick={() => setFilterCompleted(true)}>Completed</Button>
        <Button variant={filterCompleted === null ? "default" : "outline"} size="sm" onClick={() => setFilterCompleted(null)}>All</Button>
      </div>


      {isLoading && <div className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground"/></div>}
      {error && <div className="text-red-500 p-4 border border-red-500/50 bg-red-500/10 rounded-md text-center flex items-center justify-center gap-2"><AlertTriangle size={18}/> Error: {error}</div>}

      {!isLoading && skillGoals.length === 0 && (
        <div className="text-center py-10 text-muted-foreground bg-card border rounded-lg p-6">
          <Target className="mx-auto h-12 w-12 opacity-30 mb-4"/>
          No skill goals found matching your criteria. Start by adding a new goal!
        </div>
      )}

      {!isLoading && skillGoals.length > 0 && (
        <ScrollArea className="h-[calc(100vh-22rem)] sm:h-[calc(100vh-24rem)]"> {/* Adjust height */}
          <div className="space-y-4 pr-3">
            {skillGoals.map(goal => {
              const progress = getProgressPercent(goal.skill.currentXp, goal.targetXP);
              return (
                <Card key={goal.id} className={`${goal.isComplete ? 'opacity-70 border-green-500/50' : 'border-border'}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">{goal.skill.name} - Goal</CardTitle>
                            <CardDescription>Target: {goal.targetXP.toLocaleString()} XP</CardDescription>
                        </div>
                        {goal.isComplete ?
                            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" title="Completed"/> :
                            <Target className="h-6 w-6 text-blue-500 flex-shrink-0" title="In Progress"/>
                        }
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      Current XP: {goal.skill.currentXp.toLocaleString()} / {goal.targetXP.toLocaleString()}
                    </div>
                    <ProgressBar currentValue={goal.skill.currentXp} maxValue={goal.targetXP} heightClass="h-2.5"
                                 colorClass={goal.isComplete ? 'bg-green-500' : 'bg-blue-500'}/>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.toFixed(0)}% Complete</span>
                        {goal.dueDate && <span className="flex items-center"><CalendarClock size={14} className="mr-1"/>Due: {formatDueDate(goal.dueDate)}</span>}
                    </div>
                    {goal.notes && <p className="text-xs italic text-muted-foreground pt-1 mt-1 border-t border-dashed">{goal.notes}</p>}
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2 py-3 px-4 border-t">
                      {/* TODO: Edit button - opens modal with pre-filled data */}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit Goal (NYI)">
                          <Edit2 size={14}/>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete Goal" onClick={() => handleDeleteGoal(goal.id)}>
                          <Trash2 size={14}/>
                      </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default SkillGoalsPage;
