// Summary: UI Panel to display recommended Quests and Habits.
// TODO: Implement actual "Add to My Quests/Habits" functionality for CTAs.
// TODO: Refine styling and animations as per BTD6 guidelines.
// TODO: Add loading state for individual add actions.

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, ShieldQuestion, Sparkles, PlusCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { QuestType, HabitType } from '@prisma/client'; // Assuming these types exist

// Define expected data structures from /api/recommendations
interface RecommendedSkillLink {
  id: string;
  name: string;
}
interface RecommendedQuest {
  id: string; // Could be an existing quest ID or a template ID
  title: string;
  description?: string | null;
  type: QuestType; // For icon/display
  xpReward?: number | null;
  linkedSkills?: RecommendedSkillLink[];
  // Add any other fields needed to instantiate it, e.g., dependencies if it's a template
  isTemplate?: boolean; // To differentiate if instantiation is needed
}
interface RecommendedHabit {
  id: string; // Could be a template ID or pre-filled data
  name: string;
  description?: string | null;
  type: HabitType; // GOOD/BAD
  goalType?: string; // e.g. STREAK, DAILY (if applicable, from Habit model)
  linkedSkills?: RecommendedSkillLink[];
  // Add any other fields needed to create it
}

interface RecommendationsPanelProps {
  // Props if needed, e.g., to influence recommendation context, but API is generic for now
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = () => {
  const [recommendedQuests, setRecommendedQuests] = useState<RecommendedQuest[]>([]);
  const [recommendedHabits, setRecommendedHabits] = useState<RecommendedHabit[]>([]);
  const [isLoadingQuests, setIsLoadingQuests] = useState(true);
  const [isLoadingHabits, setIsLoadingHabits] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoadingQuests(true);
      setIsLoadingHabits(true);
      setError(null);
      try {
        const [questsRes, habitsRes] = await Promise.all([
          fetch('/api/recommendations?type=quests'),
          fetch('/api/recommendations?type=habits'),
        ]);

        if (!questsRes.ok) {
          const errData = await questsRes.json();
          console.error('Failed to fetch quest recommendations:', errData.error || 'Unknown error');
          // Don't throw, allow habits to load
        } else {
          const questsData: RecommendedQuest[] = await questsRes.json();
          setRecommendedQuests(questsData);
        }

        if (!habitsRes.ok) {
          const errData = await habitsRes.json();
          console.error('Failed to fetch habit recommendations:', errData.error || 'Unknown error');
          // Don't throw, allow quests to load
        } else {
          const habitsData: RecommendedHabit[] = await habitsRes.json();
          setRecommendedHabits(habitsData);
        }
        if (!questsRes.ok && !habitsRes.ok) {
            throw new Error("Failed to fetch any recommendations.")
        }

      } catch (err: any) {
        setError(err.message);
        toast.error(`Error loading recommendations: ${err.message}`);
      } finally {
        setIsLoadingQuests(false);
        setIsLoadingHabits(false);
      }
    };
    fetchRecommendations();
  }, []);

  const handleAddQuest = async (quest: RecommendedQuest) => {
    // For MVP, assume recommendation provides enough data to create a new quest
    // or if it's a template, it would call an instantiate endpoint.
    // This is a simplified version.
    const newQuestData = {
        title: quest.title,
        description: quest.description,
        type: quest.type,
        xpReward: quest.xpReward,
        // TODO: Handle dependencies if linkedSkills are to be converted
    };
    toast.loading('Adding quest...');
    try {
        // If quest.isTemplate and quest.id is a templateId, call instantiate endpoint
        // const apiPath = quest.isTemplate ? `/api/quest-templates/${quest.id}/instantiate` : '/api/quests';
        // For now, assuming it's data for a new quest:
        const response = await fetch('/api/quests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newQuestData),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to add quest.');
        }
        toast.dismiss();
        toast.success(<span>Quest "<strong>{quest.title}</strong>" added! <CheckCircle className="inline h-5 w-5 text-green-500 ml-1"/></span>, {duration: 4000});
        // TODO: Optionally remove from recommendations or update UI state
    } catch (err: any) {
        toast.dismiss();
        toast.error(`Failed to add quest: ${err.message}`);
    }
  };

  const handleAddHabit = async (habit: RecommendedHabit) => {
    const newHabitData = {
        name: habit.name,
        description: habit.description,
        type: habit.type,
        goalType: habit.goalType || 'DAILY', // Default if not provided
        // TODO: Handle linkedSkills for habits if applicable in backend
    };
    toast.loading('Adding habit...');
    try {
        const response = await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newHabitData),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to add habit.');
        }
        toast.dismiss();
        toast.success(<span>Habit "<strong>{habit.name}</strong>" added! <CheckCircle className="inline h-5 w-5 text-green-500 ml-1"/></span>, {duration: 4000});
        // TODO: Optionally remove from recommendations or update UI state
    } catch (err: any) {
        toast.dismiss();
        toast.error(`Failed to add habit: ${err.message}`);
    }
  };


  if (error && !isLoadingQuests && !isLoadingHabits && recommendedQuests.length === 0 && recommendedHabits.length === 0) {
    return <Card><CardContent className="p-6 text-center text-red-500">Error loading recommendations: {error}</CardContent></Card>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Sparkles className="mr-2 h-6 w-6 text-yellow-500" /> Recommendations
        </CardTitle>
        <CardDescription>Suggested Quests and Habits to help you grow.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quests">Quests ({isLoadingQuests ? '...' : recommendedQuests.length})</TabsTrigger>
            <TabsTrigger value="habits">Habits ({isLoadingHabits ? '...' : recommendedHabits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="quests" className="mt-4">
            {isLoadingQuests && <p className="text-center text-muted-foreground py-4">Loading quest recommendations...</p>}
            {!isLoadingQuests && recommendedQuests.length === 0 && <p className="text-center text-muted-foreground py-4">No quest recommendations available right now.</p>}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {recommendedQuests.map(quest => (
                <RecommendationItem
                    key={`q-${quest.id}`}
                    title={quest.title}
                    description={quest.description}
                    typeIcon={<ShieldQuestion className="h-5 w-5 text-purple-500"/>}
                    linkedSkills={quest.linkedSkills}
                    onAdd={() => handleAddQuest(quest)}
                    addLabel="Start Quest"
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="habits" className="mt-4">
            {isLoadingHabits && <p className="text-center text-muted-foreground py-4">Loading habit recommendations...</p>}
            {!isLoadingHabits && recommendedHabits.length === 0 && <p className="text-center text-muted-foreground py-4">No habit recommendations available right now.</p>}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {recommendedHabits.map(habit => (
                <RecommendationItem
                    key={`h-${habit.id}`}
                    title={habit.name}
                    description={habit.description}
                    typeIcon={<Zap className={`h-5 w-5 ${habit.type === HabitType.GOOD ? 'text-green-500' : 'text-red-500'}`}/>}
                    linkedSkills={habit.linkedSkills}
                    onAdd={() => handleAddHabit(habit)}
                    addLabel="Add Habit"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Sub-component for individual recommendation items
interface RecommendationItemProps {
    title: string;
    description?: string | null;
    typeIcon: React.ReactNode;
    linkedSkills?: RecommendedSkillLink[];
    onAdd: () => Promise<void>;
    addLabel: string;
}
const RecommendationItem: React.FC<RecommendationItemProps> = ({ title, description, typeIcon, linkedSkills, onAdd, addLabel }) => {
    const [isAdding, setIsAdding] = useState(false);
    const handleAddItem = async () => {
        setIsAdding(true);
        await onAdd();
        setIsAdding(false);
    }
    return (
        <div className="p-3 border rounded-md bg-background hover:bg-muted/30 transition-colors">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <h4 className="font-semibold text-sm flex items-center">
                        {typeIcon}
                        <span className="ml-2">{title}</span>
                    </h4>
                    {description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={handleAddItem} disabled={isAdding} className="ml-2 flex-shrink-0">
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="mr-1.5 h-4 w-4" />}
                    {addLabel}
                </Button>
            </div>
            {linkedSkills && linkedSkills.length > 0 && (
                <div className="mt-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Related Skills: </span>
                    {linkedSkills.map((skill, index) => (
                        <Badge key={skill.id} variant="secondary" className="mr-1 text-xs">
                            {skill.name}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}


export default RecommendationsPanel;
// Summary: UI Panel to display recommended Quests and Habits.
// Fetches data from /api/recommendations.
// Allows adding recommended items to user's list.
// TODO: Implement actual "Add to My Quests/Habits" functionality for CTAs if API needs more than just POSTing basic data.
// TODO: Refine styling and animations as per BTD6 guidelines. Consider more distinct visual feedback on add.
// TODO: Add loading state for individual add actions more visibly on the button.
// TODO: Ensure API response for recommendations matches defined interfaces.
// TODO: If a recommendation is already added, CTA should be disabled or indicate "Added".
// TODO: For quests, if isTemplate is true, logic should POST to /api/quest-templates/[id]/instantiate.
// TODO: For habits, if linkedSkills are part of recommendation, ensure they are handled if Habit model supports linking.
// TODO: Need Loader2 icon import if not already global.
import { Loader2 } from 'lucide-react'; // Add Loader2 import
