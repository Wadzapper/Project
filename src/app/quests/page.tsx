'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QuestFormModal, { QuestFormData, QuestDependencyFormData } from '@/components/quests/QuestFormModal';
import { Skill } from '@/app/skills/page'; // Skill type for dropdown
import { QuestStatus, QuestType, QuestDependencyType, UserAchievement as PrismaUserAchievement, Tag as PrismaTag } from '@prisma/client'; // Added PrismaTag
import ProgressBar from '@/components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"; // For new filters
import { Checkbox } from "@/components/ui/checkbox"; // For tag multiselect
import { Label } from "@/components/ui/label"; // For tag multiselect
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // For tag multiselect
import { Button } from '@/components/ui/button'; // Already imported but ensure it's available for new buttons
import { Filter, XCircle } from 'lucide-react';

// Define UserAchievement with nested Achievement details for toast
interface UserAchievementWithDetails extends PrismaUserAchievement {
    achievement: {
        name: string;
        icon?: string | null;
    };
}


// Local Tag interface, should match what API returns for Quest.tags
interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export type QuestDisplay = {
  id: string;
  // name: string; // API now returns 'title' primarily
  title: string; // Use 'title' as the primary display name field
  description: string | null;
  status: QuestStatus;
  type: QuestType;
  createdAt: string;
  dependencies: QuestDependencyFormData[];
  tags: Tag[]; // Added tags
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<QuestDisplay[]>([]);
  const [isLoadingQuests, setIsLoadingQuests] = useState(true);
  const [filterStatus, setFilterStatus] = useState<QuestStatus>(QuestStatus.IN_PROGRESS);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [userSkills, setUserSkills] = useState<Skill[]>([]); // Used for modal and now skill filter

  // New filter states
  const [availableTagsForFilter, setAvailableTagsForFilter] = useState<PrismaTag[]>([]);
  const [selectedTagIdsForFilter, setSelectedTagIdsForFilter] = useState<string[]>([]);
  const [filterIsChained, setFilterIsChained] = useState<'any' | 'yes' | 'no'>('any');
  const [filterBySkillId, setFilterBySkillId] = useState<string>(''); // Empty string for 'any'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentQuestForModal, setCurrentQuestForModal] = useState<Omit<QuestFormData, 'tagIds' | 'name'> & { name?: string; title?: string; tags?: Tag[] } | null>(null); // Adjusted type for initialData
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const fetchQuests = useCallback(async () => {
    setIsLoadingQuests(true);
    setPageMessage(null);

    const queryParams = new URLSearchParams();
    queryParams.append('status', filterStatus);
    if (selectedTagIdsForFilter.length > 0) {
      queryParams.append('tagIds', selectedTagIdsForFilter.join(','));
    }
    if (filterIsChained === 'yes') {
      queryParams.append('isChained', 'true');
    } else if (filterIsChained === 'no') {
      queryParams.append('isChained', 'false');
    }
    if (filterBySkillId) {
      queryParams.append('skillId', filterBySkillId);
    }

    try {
      const response = await fetch(`/api/quests?${queryParams.toString()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch quests');
      }
      const data = await response.json();
      setQuests(data);
    } catch (error: any) {
      console.error(error);
      setPageMessage({ type: 'error', text: error.message || 'Could not load quests.' });
      setQuests([]);
    } finally {
      setIsLoadingQuests(false);
    }
  }, [filterStatus, selectedTagIdsForFilter, filterIsChained, filterBySkillId]);

  const fetchUserSkillsAndTags = async () => {
    try {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Failed to fetch user skills for quest form');
      const data = await response.json();
      setUserSkills(data);
    } catch (error) {
      console.error(error);
      toast.error("Could not load skills/tags for filters.");
    }
  };

  useEffect(() => {
    fetchQuests();
    fetchUserSkillsAndTags();
  }, [fetchQuests]); // fetchQuests is memoized with all filter dependencies

  const handleOpenCreateQuestModal = () => {
    setModalMode('create');
    setCurrentQuestForModal(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseQuestModal = () => {
    setIsModalOpen(false);
    setCurrentQuestForModal(null);
    setFormError(null);
  };

  // QuestFormModal now submits QuestFormData which includes tagIds
  const handleSubmitQuest = async (questData: QuestFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    setPageMessage(null);

    // The API expects dependencies. QuestFormModal structures them correctly.
    const url = modalMode === 'create' ? '/api/quests' : `/api/quests/${questData.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${modalMode} quest`);
      }

      const responseData: { updatedQuest: QuestDisplay, unlockedAchievements: UserAchievementWithDetails[] } = await response.json();

      setPageMessage({ type: 'success', text: `Quest ${modalMode === 'create' ? 'created' : 'updated'} successfully!` });

      if (responseData.unlockedAchievements && responseData.unlockedAchievements.length > 0) {
        responseData.unlockedAchievements.forEach(ua => {
          toast.success(`Achievement Unlocked: ${ua.achievement.icon || '🏆'} ${ua.achievement.name}!`, { duration: 5000 });
        });
      }

      handleCloseQuestModal();
      fetchQuests(); // Re-fetch with current filters
      // router.refresh(); // Might not be needed if fetchQuests updates state sufficiently
    } catch (error: any) {
      setFormError(error.message); // This error is for the modal
      toast.error(error.message); // Show general toast too
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuest = async (questId: string) => {
    setPageMessage(null);
    if (window.confirm('Are you sure you want to delete this quest?')) {
      try {
        const response = await fetch(`/api/quests/${questId}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete quest');
        }
        setPageMessage({ type: 'success', text: 'Quest deleted successfully.' });
        fetchQuests(); // Re-fetch with current filters
        // router.refresh();
      } catch (error: any) {
        setPageMessage({ type: 'error', text: error.message });
        toast.error(error.message);
      }
    }
  };

  const handleOpenEditQuestModal = (quest: QuestDisplay) => {
    setModalMode('edit');
    const initialModalData: Omit<QuestFormData, 'tagIds'|'name'> & {name?:string; title?: string; tags?: Tag[]} = {
        id: quest.id,
        title: quest.title, // Use title from QuestDisplay
        description: quest.description || '',
        type: quest.type,
        status: quest.status,
        dependencies: quest.dependencies.map(dep => ({
            ...dep,
            tempId: dep.id || crypto.randomUUID(),
            targetDate: dep.targetDate ? dep.targetDate.split('T')[0] : null,
        })),
        tags: quest.tags, // Pass the array of Tag objects to QuestFormModal
    };
    setCurrentQuestForModal(initialModalData);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleTagFilterChange = (tagId: string, selected: boolean) => {
    setSelectedTagIdsForFilter(prev =>
      selected ? [...prev, tagId] : prev.filter(id => id !== tagId)
    );
  };

  const clearAllFilters = () => {
    setFilterStatus(QuestStatus.IN_PROGRESS); // Reset to default status
    setSelectedTagIdsForFilter([]);
    setFilterIsChained('any');
    setFilterBySkillId('');
    // fetchQuests will be called by useEffect due to filterStatus change
  };


  const questStatusColors: Record<string, { bg: string, text: string, border: string }> = {
    [QuestStatus.PENDING]: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-600'},
    [QuestStatus.IN_PROGRESS]: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-400 dark:border-blue-700'},
    [QuestStatus.COMPLETED]: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300', border: 'border-green-400 dark:border-green-700'},
    [QuestStatus.FAILED]: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', border: 'border-red-400 dark:border-red-700'},
    [QuestStatus.CANCELLED]: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-400 dark:border-yellow-700'},
  };

  const statusFilters: QuestStatus[] = [QuestStatus.IN_PROGRESS, QuestStatus.PENDING, QuestStatus.COMPLETED, QuestStatus.FAILED, QuestStatus.CANCELLED];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Quests</h1>
        <button
          onClick={handleOpenCreateQuestModal}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          + Create New Quest
        </button>
      </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}role="alert">
          {pageMessage.text}
        </div>
      )}

      <div className="mb-6">
        {/* Filter Panel */}
      <Card className="mb-6">
        <CardHeader>
            <CardTitle className="text-lg flex items-center"><Filter className="mr-2 h-5 w-5"/>Filter Quests</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
                <Label htmlFor="skill-filter">By Skill</Label>
                <Select value={filterBySkillId} onValueChange={setFilterBySkillId}>
                    <SelectTrigger id="skill-filter"><SelectValue placeholder="Any Skill" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Any Skill</SelectItem>
                        {userSkills.map(skill => <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="chain-filter">Chain Status</Label>
                <Select value={filterIsChained} onValueChange={(v) => setFilterIsChained(v as 'any'|'yes'|'no')}>
                    <SelectTrigger id="chain-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="yes">Chained Only</SelectItem>
                        <SelectItem value="no">Not Chained</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="sm:col-span-2 md:col-span-2">
                <Label>By Tags</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                            {selectedTagIdsForFilter.length > 0
                                ? `${selectedTagIdsForFilter.length} tag(s) selected`
                                : "Select tags..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto p-0">
                        <div className="p-2 space-y-1">
                        {availableTagsForFilter.length > 0 ? availableTagsForFilter.map(tag => (
                            <div key={tag.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-muted rounded-sm">
                                <Checkbox
                                    id={`filter-tag-${tag.id}`}
                                    checked={selectedTagIdsForFilter.includes(tag.id)}
                                    onCheckedChange={(checked) => handleTagFilterChange(tag.id, !!checked)}
                                />
                                <Label htmlFor={`filter-tag-${tag.id}`} className="text-sm font-normal flex items-center cursor-pointer w-full">
                                    {tag.color && <span className="w-3 h-3 rounded-sm mr-2 inline-block border" style={{backgroundColor: tag.color}}></span>}
                                    {tag.name}
                                </Label>
                            </div>
                        )) : <p className="p-2 text-xs text-muted-foreground">No tags available.</p>}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex items-end">
                 <Button variant="ghost" onClick={clearAllFilters} className="w-full sm:w-auto text-xs">
                    <XCircle className="mr-1.5 h-4 w-4"/> Clear All Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
            {statusFilters.map((status) => (
              <button /* ... existing status tab button ... */
                key={status}
                onClick={() => setFilterStatus(status)}
                aria-label={`Filter by status: ${status.replace('_', ' ')}`}
                className={`${
                  filterStatus === status
                    ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                } whitespace-nowrap py-3 px-2 sm:px-3 border-b-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 rounded-t-md`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {isLoadingQuests && <div className="text-center py-10"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/> Loading quests...</div>}
      {!isLoadingQuests && quests.length === 0 && (
        <div className="p-6 text-center bg-muted/30 border rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">No quests found for the current filters.</p>
        </div>
      ) : !isLoadingQuests && (
        <div className="space-y-4">
          {quests.map((quest) => {
            const colors = questStatusColors[quest.status] || questStatusColors[QuestStatus.PENDING];
            return (
              // Added focus-visible to the quest card container for keyboard navigation if it becomes interactive
              <div key={quest.id} className={`p-4 rounded-lg shadow-sm border ${colors.bg} ${colors.border} focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800`}>
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow mb-2 sm:mb-0">
                        <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{quest.title}</h2> {/* Use title */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                                {quest.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                                {quest.type.replace('_', ' ')}
                            </span>
                            {/* Display Tags */}
                            {quest.tags && quest.tags.map(tag => (
                                <span key={tag.id} className="text-xs font-medium px-2 py-0.5 rounded-full border" style={{ backgroundColor: tag.color || '#E5E7EB', color: tag.color ? (parseInt(tag.color.substring(1), 16) > 0xffffff / 2 ? '#000' : '#fff') : '#374151'}}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0 mt-2 sm:mt-0">
                        <button aria-label={`Edit quest ${quest.title}`} onClick={() => handleOpenEditQuestModal(quest)} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Edit</button>
                        <button aria-label={`Delete quest ${quest.title}`} onClick={() => handleDeleteQuest(quest.id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Delete</button>
                    </div>
                </div>
                {quest.description && <p className={`mt-2 text-sm ${colors.text} opacity-90`}>{quest.description}</p>}

                {/* Quest Progress Bar */}
                {quest.dependencies && quest.dependencies.length > 0 && quest.status !== QuestStatus.COMPLETED && quest.status !== QuestStatus.FAILED && quest.status !== QuestStatus.CANCELLED && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className={`${colors.text} opacity-80`}>Progress</span>
                      <span className={`${colors.text} opacity-80`}>
                        {quest.dependencies.filter(d => d.isCompleted).length} / {quest.dependencies.length}
                      </span>
                    </div>
                    <ProgressBar
                      currentValue={quest.dependencies.filter(d => d.isCompleted).length}
                      maxValue={quest.dependencies.length}
                      heightClass="h-2"
                      colorClass={ (quest.status === QuestStatus.IN_PROGRESS || quest.status === QuestStatus.PENDING) ? 'bg-blue-500' : 'bg-green-500'}
                    />
                  </div>
                )}

                {quest.dependencies && quest.dependencies.length > 0 && (
                  <div className="mt-2">
                    <details className="group">
                      <summary className={`text-xs font-medium cursor-pointer ${colors.text} opacity-80 group-hover:opacity-100`}>
                        Dependencies ({quest.dependencies.length})
                      </summary>
                      <ul className="list-disc list-inside pl-2 mt-1 space-y-0.5">
                        {quest.dependencies.map(dep => (
                          <li key={dep.id || dep.tempId} className={`text-xs ${colors.text} opacity-70 ${dep.isCompleted ? 'line-through' : ''}`}>
                            {dep.description || dep.type.replace(/_/g, ' ')}
                            {/* TODO: Display more dep details like target skill/level/xp if applicable */}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QuestFormModal
        isOpen={isModalOpen}
        onClose={handleCloseQuestModal}
        onSubmit={handleSubmitQuest}
        initialData={currentQuestForModal}
        mode={modalMode}
        isLoading={isSubmitting}
        error={formError}
        userSkills={userSkills}
      />
    </div>
  );
}
