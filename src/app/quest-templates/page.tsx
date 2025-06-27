// Summary: Page for viewing and instantiating Quest Templates.
// TODO: Implement creation/editing/archiving of Quest Templates (links to a management UI if separate).
// TODO: Enhance QuestTemplateCard with more details (e.g., fetch skill names for linkedSkillIds).
// TODO: Add filtering for archived/active templates.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, PlusSquare, CheckCircle, Loader2, AlertTriangle, ArrowLeft, Archive, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { QuestTemplate, QuestType } from '@prisma/client'; // Assuming Prisma types
import { useRouter } from 'next/navigation'; // For back button or navigation

// Interface for QuestTemplate data fetched from API
// (Matches Prisma model, potentially with linked skill names if API were to populate them)
interface QuestTemplateDisplay extends QuestTemplate {
  // linkedSkillsDetails?: { id: string, name: string }[]; // If API were to populate this
}

// --- QuestTemplateCard Component ---
interface QuestTemplateCardProps {
  template: QuestTemplateDisplay;
  onInstantiate: (templateId: string) => Promise<void>;
  isInstantiating: boolean; // To disable button during instantiation
}

const QuestTemplateCard: React.FC<QuestTemplateCardProps> = ({ template, onInstantiate, isInstantiating }) => {
  return (
    <Card className="flex flex-col h-full hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 ease-in-out cursor-default">
      {/* cursor-default because the button inside is the primary action, not the whole card typically */}
      <CardHeader>
        <CardTitle className="text-lg">{template.title}</CardTitle>
        {template.description && <CardDescription className="text-xs line-clamp-2 h-8">{template.description}</CardDescription>} {/* Fixed height for description */}
      </CardHeader>
      <CardContent className="flex-grow space-y-2 text-sm">
        <div className="flex items-center">
          <span className="font-semibold w-24">Type:</span>
          <span className="text-muted-foreground">{template.type.replace('_', ' ')}</span>
        </div>
        {template.xpReward !== null && template.xpReward > 0 && (
          <div className="flex items-center">
            <span className="font-semibold w-24">XP Reward:</span>
            <span className="text-muted-foreground">{template.xpReward}</span>
          </div>
        )}
        {template.linkedSkillIds && template.linkedSkillIds.length > 0 && (
          <div>
            <span className="font-semibold">Linked Skills:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {template.linkedSkillIds.map(skillId => (
                <span key={skillId} className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                  ID: {skillId.substring(0, 8)}... {/* Displaying ID for now, ideally fetch names */}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
            size="sm"
            className="w-full mt-auto" // Ensure button is at the bottom if content is short
            onClick={() => onInstantiate(template.id)}
            disabled={isInstantiating}
        >
          {isInstantiating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusSquare className="mr-2 h-4 w-4" />}
          Instantiate Quest
        </Button>
      </CardFooter>
    </Card>
  );
};


// --- QuestTemplateList Component ---
interface QuestTemplateListProps {
  templates: QuestTemplateDisplay[];
  onInstantiate: (templateId: string) => Promise<void>;
  isInstantiatingTemplateId: string | null;
}

const QuestTemplateList: React.FC<QuestTemplateListProps> = ({ templates, onInstantiate, isInstantiatingTemplateId }) => {
  if (templates.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground bg-card border rounded-lg p-6 min-h-[200px] flex flex-col justify-center items-center">
        <FileText className="mx-auto h-12 w-12 opacity-30 mb-4"/>
        <p>No quest templates found.</p>
        {/* TODO: If user can create templates, add a CTA here or ensure main page has one. */}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> {/* Increased gap */}
      {templates.map(template => (
        <QuestTemplateCard
            key={template.id}
            template={template}
            onInstantiate={onInstantiate}
            isInstantiating={isInstantiatingTemplateId === template.id}
        />
      ))}
    </div>
  );
};


// --- Main Page Component ---
const QuestTemplatesPage = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<QuestTemplateDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);

  const fetchQuestTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/quest-templates?archived=${showArchived}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch quest templates.');
      }
      const data: QuestTemplateDisplay[] = await response.json();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchQuestTemplates();
  }, [fetchQuestTemplates]);

  const handleInstantiateQuest = async (templateId: string) => {
    setInstantiatingId(templateId);
    toast.loading(`Instantiating quest from template...`);
    try {
      const response = await fetch(`/api/quest-templates/${templateId}/instantiate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to instantiate quest.');
      }
      const newQuest = await response.json();
      toast.dismiss();
      toast.success(<span>Quest "<strong>{newQuest.title}</strong>" created from template! <CheckCircle className="inline h-5 w-5 text-green-500 ml-1"/></span>, { duration: 4000 });
      // Optionally, navigate to the new quest or refresh a general quest list if it's on another page
      // router.push(`/quests/${newQuest.id}`);
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Instantiation failed: ${err.message}`);
    } finally {
        setInstantiatingId(null);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="sm:hidden mb-2 self-start">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center"><FileText className="mr-3 h-8 w-8 text-primary"/> Quest Templates</h1>
        <div className="flex items-center space-x-2">
            <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                title={showArchived ? "Hide Archived Templates" : "Show Archived Templates"}
            >
                {showArchived ? <Eye className="mr-2 h-4 w-4"/> : <Archive className="mr-2 h-4 w-4"/>}
                {showArchived ? "Showing Archived" : "Show Archived"}
            </Button>
            {/* TODO: Add "Create New Template" button linking to a create/edit UI */}
            {/* <Button size="sm"><PlusSquare className="mr-2 h-4 w-4"/> Create Template</Button> */}
        </div>
      </div>

      {isLoading && <div className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground"/></div>}
      {error && <div className="text-red-500 p-4 border border-red-500/50 bg-red-500/10 rounded-md text-center flex items-center justify-center gap-2"><AlertTriangle size={18}/> Error: {error}</div>}

      {!isLoading && !error && (
        <QuestTemplateList
            templates={templates}
            onInstantiate={handleInstantiateQuest}
            isInstantiatingTemplateId={instantiatingId}
        />
      )}
    </div>
  );
};

export default QuestTemplatesPage;
