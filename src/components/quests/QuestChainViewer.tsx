// Summary: Displays a list/tree of quests in a chain.
// TODO: Implement more sophisticated tree/graph layout if chains can be non-linear.
// TODO: Consider visual cues for quest dependencies within the chain view.
// TODO: Add click handlers to navigate to other quests in the chain.

'use client';

import React, { useEffect, useState } from 'react';
import { Quest, QuestStatus, QuestType } from '@prisma/client';
import { Loader2, AlertTriangle, ListTree, CheckCircle2, Circle, XCircle, ChevronsRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils'; // For conditional class names

// Simplified Quest type for the chain view
export interface ChainedQuest extends Pick<Quest, 'id' | 'title' | 'status' | 'type' | 'parentQuestId' | 'createdAt'> {
  // Potentially add orderInChain if schema supports it
}

interface QuestChainViewerProps {
  currentQuestId: string;
  // API will use currentQuestId to find the chain
}

const QuestChainViewer: React.FC<QuestChainViewerProps> = ({ currentQuestId }) => {
  const [chainQuests, setChainQuests] = useState<ChainedQuest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentQuestId) return;

    const fetchChain = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/quests/chain/${currentQuestId}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch quest chain.');
        }
        const data: ChainedQuest[] = await response.json();

        // The API should ideally return them sorted. If not, sort here.
        // For now, assuming API returns them in a displayable order (e.g. by createdAt or an explicit order field)
        setChainQuests(data);
      } catch (err: any) {
        setError(err.message);
        setChainQuests([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChain();
  }, [currentQuestId]);

  const getStatusIcon = (status: QuestStatus) => {
    switch (status) {
      case QuestStatus.COMPLETED: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case QuestStatus.FAILED: return <XCircle className="h-4 w-4 text-red-500" />;
      case QuestStatus.CANCELLED: return <XCircle className="h-4 w-4 text-yellow-500" />;
      case QuestStatus.IN_PROGRESS: return <ChevronsRight className="h-4 w-4 text-blue-500 animate-pulse" />;
      case QuestStatus.PENDING: return <Circle className="h-4 w-4 text-muted-foreground" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getQuestTypeShort = (type: QuestType) => {
      // Simple abbreviation or first letter
      return type.substring(0,1).toUpperCase();
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-4 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading chain...</div>;
  }
  if (error) {
    return <div className="flex items-center p-4 text-red-500"><AlertTriangle className="mr-2 h-4 w-4" />Error: {error}</div>;
  }
  if (chainQuests.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">This quest does not appear to be part of a chain, or chain data is unavailable.</p>;
  }

  // Simple linear list rendering for now. A tree would require hierarchical data.
  // Assuming the API returns a flat list, ordered correctly.
  return (
    <div className="space-y-2">
      {chainQuests.map((quest, index) => (
        <div
          key={quest.id}
          className={cn(
            "flex items-center justify-between p-3 rounded-md border",
            quest.id === currentQuestId ? "bg-primary/10 ring-2 ring-primary" : "bg-background hover:bg-muted/50",
            quest.status === QuestStatus.COMPLETED ? "opacity-70" : ""
          )}
        >
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-muted-foreground w-5 text-center">{index + 1}.</span>
            {getStatusIcon(quest.status)}
            <span className="font-medium text-sm">{quest.title}</span>
          </div>
          <Badge variant="outline" className="text-xs">{getQuestTypeShort(quest.type)}</Badge>
        </div>
      ))}
       {/* TODO: Implement "Editor" part - reordering, adding/removing from chain (complex) */}
    </div>
  );
};

export default QuestChainViewer;
