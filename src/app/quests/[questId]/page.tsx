// Summary: Page to display details of a single quest and its chain if applicable.
// TODO: Enhance quest detail display (dependencies, rewards, etc.).
// TODO: Add error handling for quest not found specifically (currently caught by general error).
// TODO: Implement actual <QuestChainViewer /> component and integrate.

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Quest, QuestStatus, QuestType, QuestDependency, Skill, UserAchievement } from '@prisma/client'; // Assuming full Quest type
import { Button } from '@/components/ui/button';
import { ArrowLeft, Link2, ListTree, ShieldCheck, Zap, CalendarDays } from 'lucide-react'; // Removed CheckSquare, XSquare as status icon comes from viewer
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import QuestChainViewer from '@/components/quests/QuestChainViewer'; // Import actual component

// Define a more detailed Quest type that might be returned by GET /api/quests/[questId]
export interface QuestDetail extends Quest {
  dependencies: (QuestDependency & { skill?: Pick<Skill, 'id' | 'name'> })[];
  // Potential fields if API denormalizes chain info:
  parentQuestId?: string | null;
  // rootQuestId?: string | null; // Or this, if API provides the root of the chain
  // chainName?: string | null;
  // siblingQuestsInChain?: Pick<Quest, 'id' | 'title' | 'status' | 'orderInChain'>[]; // If API returns siblings
  unlockedAchievements?: UserAchievement[]; // If PATCH returns this
}


const QuestDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const questId = params.questId as string;

  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questId) {
      setError("No quest ID provided.");
      setIsLoading(false);
      return;
    }

    const fetchQuestDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/quests/${questId}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to fetch quest (ID: ${questId})`);
        }
        const data: QuestDetail = await response.json();
        setQuest(data);
      } catch (err: any) {
        setError(err.message);
        setQuest(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestDetails();
  }, [questId]);

  const getStatusBadgeVariant = (status: QuestStatus) => {
    switch (status) {
      case QuestStatus.COMPLETED: return "success";
      case QuestStatus.FAILED: return "destructive";
      case QuestStatus.IN_PROGRESS: return "default";
      case QuestStatus.PENDING: return "outline";
      case QuestStatus.CANCELLED: return "secondary";
      default: return "secondary";
    }
  };

  // Check if this quest is part of a chain.
  // For MVP, we'll assume if parentQuestId is present OR if the API for a single quest explicitly returns chain info, it's part of a chain.
  // The QuestChainViewer will then fetch the whole chain based on currentQuestId.
  // The schema added parentQuestId. The API GET /api/quests/[questId] should return this.
  // A quest is part of a chain if it has a parent, or if it *is* a parent to others (which QuestChainViewer would determine).
  // For simplicity here, if parentQuestId is non-null, we assume it's in a chain.
  // The API /api/quests/chain/[questId] is responsible for finding the full chain regardless of where currentQuestId is.
  const isPotentiallyInChain = quest?.parentQuestId !== undefined; // If the field exists, it might be in a chain.
                                                                // A more robust check might be if an API call to /api/quests/chain/[questId] returns > 1 quest.
                                                                // For now, render the viewer if parentQuestId is part of the quest model.
                                                                // The QuestChainViewer itself handles the case of no chain found.

  if (isLoading) return <div className="container mx-auto p-6 text-center">Loading quest details...</div>;
  if (error) return <div className="container mx-auto p-6 text-center text-red-500">Error: {error}</div>;
  if (!quest) return <div className="container mx-auto p-6 text-center">Quest not found.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quests
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
            <CardTitle className="text-2xl lg:text-3xl">{quest.title}</CardTitle>
            <div className="flex items-center space-x-2 flex-shrink-0 mt-2 sm:mt-0">
                <Badge variant={getStatusBadgeVariant(quest.status)} className="text-xs sm:text-sm">
                    {quest.status.replace('_', ' ')}
                </Badge>
                <Badge variant="secondary" className="text-xs sm:text-sm">{quest.type.replace('_', ' ')}</Badge>
            </div>
          </div>
          {quest.description && <CardDescription className="mt-2 text-md">{quest.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {quest.xpReward && quest.xpReward > 0 && (
            <div className="flex items-center text-sm">
              <Zap className="mr-2 h-4 w-4 text-yellow-500" />
              <span>XP Reward: {quest.xpReward}</span>
            </div>
          )}
          {quest.deadline && (
            <div className="flex items-center text-sm">
              <CalendarDays className="mr-2 h-4 w-4 text-orange-500" />
              <span>Deadline: {new Date(quest.deadline).toLocaleDateString()}</span>
            </div>
          )}
          {quest.dependencies && quest.dependencies.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 text-sm">Dependencies:</h4>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                {quest.dependencies.map(dep => (
                  <li key={dep.id} className={`text-xs ${dep.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                    {dep.skill ? `Skill: ${dep.skill.name}` : dep.description || dep.type.replace('_', ' ')}
                    {dep.targetLevel && ` (Lvl ${dep.targetLevel})`}
                    {dep.targetXp && ` (${dep.targetXp} XP)`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
            <p>Created: {new Date(quest.createdAt).toLocaleDateString()}</p>
            {quest.completedAt && <p className="ml-auto">Completed: {new Date(quest.completedAt).toLocaleDateString()}</p>}
        </CardFooter>
      </Card>

      {/* Quest Chain Viewer Integration */}
      {/* Render QuestChainViewer if questId is available.
          The viewer itself will determine if a chain exists and handle empty/error states.
          The 'isPartOfChain' logic was a bit presumptive. Let the viewer decide.
      */}
      {questId && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <ListTree className="mr-2 h-6 w-6 text-primary" /> Quest Chain Context
          </h2>
          <QuestChainViewer currentQuestId={questId} />
        </div>
      )}

      {/* TODO: Add Edit/Delete buttons for the quest itself */}
      {/* TODO: Add UI for quest-specific actions like "Abandon Quest", "Log Progress" (if applicable) */}

    </div>
  );
};

export default QuestDetailPage;
