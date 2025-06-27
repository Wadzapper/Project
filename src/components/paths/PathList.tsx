'use client';

import React from 'react';
import { PathSummary } from '@/app/paths/page'; // Assuming PathSummary is exported or define here
import { ListChecks } from 'lucide-react';

interface PathListProps {
  paths: PathSummary[];
  onSelectPath: (id: string) => void;
  selectedPathId: string | null;
  isLoading?: boolean; // Optional loading state from parent
}

const PathList: React.FC<PathListProps> = ({ paths, onSelectPath, selectedPathId, isLoading }) => {
  if (isLoading) {
    return <div className="text-muted-foreground">Loading paths list...</div>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold mb-3 flex items-center">
        <ListChecks className="mr-2 h-6 w-6 text-primary" /> My Learning Paths
      </h2>
      {paths.length === 0 && (
        <p className="text-muted-foreground p-4 border border-dashed rounded-md">
          No paths created yet. Click "Create New Path" to get started!
        </p>
      )}
      {paths.map(path => (
        <div
          key={path.id}
          onClick={() => onSelectPath(path.id)}
          className={`p-3 sm:p-4 border rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 ease-in-out
                      ${selectedPathId === path.id
                        ? 'ring-2 ring-primary bg-primary/10 shadow-lg scale-[1.01]'
                        : 'bg-card hover:bg-muted/50'
                      }`}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onSelectPath(path.id)}
          aria-pressed={selectedPathId === path.id}
        >
          <h3 className="font-semibold text-md sm:text-lg text-card-foreground">{path.name}</h3>
          {path.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{path.description}</p>}
          <p className="text-xs text-muted-foreground mt-2">Steps: {path._count?.steps ?? 0}</p>
        </div>
      ))}
    </div>
  );
};

export default PathList;
