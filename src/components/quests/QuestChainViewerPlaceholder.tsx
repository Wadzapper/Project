// Summary: Placeholder for QuestChainViewer component.
// This file is temporary and will be replaced by the actual QuestChainViewer.tsx or removed.
'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QuestChainViewerPlaceholderProps {
  currentQuestId: string;
  // chainId?: string | null; // Or rootQuestId
}

const QuestChainViewerPlaceholder: React.FC<QuestChainViewerPlaceholderProps> = ({ currentQuestId }) => {
  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="text-md">Quest Chain (Viewer Placeholder)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Full quest chain details for quest <span className="font-semibold text-foreground">{currentQuestId}</span> will be displayed here by the actual QuestChainViewer component.
        </p>
        <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
          <li>Previous Quest in Chain (if any) - Status</li>
          <li className="font-bold">Current Quest: {currentQuestId} - Status</li>
          <li>Next Quest in Chain (if any) - Status</li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default QuestChainViewerPlaceholder;
