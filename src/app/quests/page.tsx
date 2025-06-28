'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuestFormModal, { QuestFormData, QuestDependencyFormData } from '@/components/quests/QuestFormModal';
import { Skill } from '@/app/skills/page';
import { QuestStatus, QuestType, QuestDependencyType, UserAchievement as PrismaUserAchievement, Tag as PrismaTag } from '@prisma/client';
import ProgressBar from '@/components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Filter, XCircle, Loader2, PlusCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

interface UserAchievementWithDetails extends PrismaUserAchievement {
    achievement: {
        name: string;
        icon?: string | null;
    };
}

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export type QuestDisplay = {
  id: string;
  title: string;
  description: string | null;
  status: QuestStatus;
  type: QuestType;
  createdAt: string;
  dependencies: QuestDependencyFormData[];
  tags: Tag[];
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<QuestDisplay[]>([]);
  const [isLoadingQuests, setIsLoadingQuests] = useState(true);
  const [filterStatus, setFilterStatus] = useState<QuestStatus>(QuestStatus.IN_PROGRESS);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);

  const [availableTagsForFilter, setAvailableTagsForFilter] = useState<PrismaTag[]>([]);
  const [selectedTagIdsForFilter, setSelectedTagIdsForFilter] = useState<string[]>([]);
  const [filterIsChained, setFilterIsChained] = useState<'any' | 'yes' | 'no'>('any');
  const [filterBySkillId, setFilterBySkillId] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentQuestForModal, setCurrentQuestForModal] = useState<Omit<QuestFormData, 'tagIds' | 'name'> & { name?: string; title?: string; tags?: Tag[] } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const fetchQuests = useCallback(async () => {
    setIsLoadingQuests(true);
    setPageMessage(null);
    const queryParams = new URLSearchParams();
    queryParams.append('status', filterStatus);
    if (selectedTagIdsForFilter.length > 0) queryParams.append('tagIds', selectedTagIdsForFilter.join(','));
    if (filterIsChained === 'yes') queryParams.append('isChained', 'true');
    else if (filterIsChained === 'no') queryParams.append('isChained', 'false');
    if (filterBySkillId) queryParams.append('skillId', filterBySkillId);

    try {
      const response = await fetch(`/api/quests?${queryParams.toString()}`);
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || 'Failed to fetch quests'); }
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

  const fetchUserSkillsAndTags = useCallback(async () => {
    try {
      const [skillsRes, tagsRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/tags')
      ]);

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        setUserSkills(skillsData);
      } else {
        toast.error('Failed to load skills for filters.');
      }

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setAvailableTagsForFilter(tagsData);
      } else {
        toast.error('Failed to load tags for filters.');
      }
    } catch (error) {
      console.error("Error fetching skills/tags for filters:", error);
      toast.error("Could not load filter data.");
    }
  }, []);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  useEffect(() => {
    fetchUserSkillsAndTags();
  }, [fetchUserSkillsAndTags]);

  const handleOpenCreateQuestModal = () => {
    setModalMode('create'); setCurrentQuestForModal(null); setFormError(null); setIsModalOpen(true);
  };
  const handleCloseQuestModal = () => {
    setIsModalOpen(false); setCurrentQuestForModal(null); setFormError(null);
  };

  const handleSubmitQuest = async (questData: QuestFormData) => {
    setIsSubmitting(true); setFormError(null); setPageMessage(null);
    const url = modalMode === 'create' ? '/api/quests' : `/api/quests/${questData.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(questData) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Failed to ${modalMode} quest`); }
      const responseData: { updatedQuest: QuestDisplay, unlockedAchievements: UserAchievementWithDetails[] } = await response.json();
      setPageMessage({ type: 'success', text: `Quest ${modalMode === 'create' ? 'created' : 'updated'} successfully!` });
      if (responseData.unlockedAchievements?.length > 0) {
        responseData.unlockedAchievements.forEach(ua => toast.success(`Achievement Unlocked: ${ua.achievement.icon || '🏆'} ${ua.achievement.name}!`, { duration: 5000 }));
      }
      handleCloseQuestModal(); fetchQuests();
    } catch (error: any) {
      setFormError(error.message); toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuest = async (questId: string) => {
    setPageMessage(null);
    if (window.confirm('Are you sure you want to delete this quest?')) {
      try {
        const response = await fetch(`/api/quests/${questId}`, { method: 'DELETE' });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to delete quest');}
        setPageMessage({ type: 'success', text: 'Quest deleted successfully.' }); fetchQuests();
      } catch (error: any) {
        setPageMessage({ type: 'error', text: error.message }); toast.error(error.message);
      }
    }
  };

  const handleOpenEditQuestModal = (quest: QuestDisplay) => {
    setModalMode('edit');
    setCurrentQuestForModal({
        id: quest.id, title: quest.title, description: quest.description || '', type: quest.type, status: quest.status,
        dependencies: quest.dependencies.map(dep => ({ ...dep, tempId: dep.id || crypto.randomUUID(), targetDate: dep.targetDate ? dep.targetDate.split('T')[0] : null })),
        tags: quest.tags,
    });
    setFormError(null); setIsModalOpen(true);
  };

  const handleTagFilterChange = (tagId: string, selected: boolean) => {
    setSelectedTagIdsForFilter(prev => selected ? [...prev, tagId] : prev.filter(id => id !== tagId));
  };

  const clearAllFilters = () => {
    setFilterStatus(QuestStatus.IN_PROGRESS); setSelectedTagIdsForFilter([]); setFilterIsChained('any'); setFilterBySkillId('');
  };

  // Using themed styles directly now
  const questStatusStyles: Record<string, { text: string, border: string, badgeBg: string, badgeText: string, progressBg: string }> = {
    [QuestStatus.PENDING]: { text: 'text-text-secondary', border: 'border-border-secondary', badgeBg: 'bg-gray-200 dark:bg-gray-700', badgeText: 'text-gray-700 dark:text-gray-100', progressBg: 'bg-gray-400 dark:bg-gray-600'},
    [QuestStatus.IN_PROGRESS]: { text: 'text-info', border: 'border-[var(--color-info)]/50', badgeBg: 'bg-[var(--color-info)]/20', badgeText: 'text-info', progressBg: 'bg-[var(--color-info)]'},
    [QuestStatus.COMPLETED]: { text: 'text-success', border: 'border-[var(--color-success)]/50', badgeBg: 'bg-[var(--color-success)]/20', badgeText: 'text-success', progressBg: 'bg-[var(--color-success)]'},
    [QuestStatus.FAILED]: { text: 'text-accent-danger', border: 'border-accent-danger/50', badgeBg: 'bg-accent-danger/20', badgeText: 'text-accent-danger', progressBg: 'bg-accent-danger'},
    [QuestStatus.CANCELLED]: { text: 'text-warning', border: 'border-[var(--color-warning)]/50', badgeBg: 'bg-[var(--color-warning)]/20', badgeText: 'text-warning', progressBg: 'bg-[var(--color-warning)]'},
  };

  const statusFilters: QuestStatus[] = [QuestStatus.IN_PROGRESS, QuestStatus.PENDING, QuestStatus.COMPLETED, QuestStatus.FAILED, QuestStatus.CANCELLED];

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
            <h1 className="text-3xl font-bold text-text-primary">My Quests</h1>
            <Button onClick={handleOpenCreateQuestModal}>
                <PlusCircle className="mr-2 h-4 w-4"/>Create New Quest
            </Button>
        </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${ pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`} role="alert">
          {pageMessage.text}
        </div>
      )}

      <Card className="mb-6 bg-bg-card border-border-primary">
        <CardHeader>
            <CardTitle className="text-lg flex items-center text-text-primary"><Filter className="mr-2 h-5 w-5 text-text-secondary"/>Filter Quests</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
                <Label htmlFor="skill-filter" className="text-text-secondary text-sm">By Skill</Label>
                <Select value={filterBySkillId} onValueChange={setFilterBySkillId}>
                    <SelectTrigger id="skill-filter" className="mt-1"><SelectValue placeholder="Any Skill" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Any Skill</SelectItem>
                        {userSkills.map(skill => <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div>
                <Label htmlFor="chain-filter" className="text-text-secondary text-sm">Chain Status</Label>
                <Select value={filterIsChained} onValueChange={(v) => setFilterIsChained(v as 'any'|'yes'|'no')}>
                    <SelectTrigger id="chain-filter" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="yes">Chained Only</SelectItem>
                        <SelectItem value="no">Not Chained</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="sm:col-span-2 md:col-span-2">
                <Label className="text-text-secondary text-sm">By Tags</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal mt-1">
                            {selectedTagIdsForFilter.length > 0 ? `${selectedTagIdsForFilter.length} tag(s) selected` : "Select tags..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto p-0">
                        <div className="p-2 space-y-1">
                        {availableTagsForFilter.length > 0 ? availableTagsForFilter.map(tag => (
                            <div key={tag.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-muted rounded-sm">
                                <Checkbox id={`filter-tag-${tag.id}`} checked={selectedTagIdsForFilter.includes(tag.id)} onCheckedChange={(checked) => handleTagFilterChange(tag.id, !!checked)} />
                                <Label htmlFor={`filter-tag-${tag.id}`} className="text-sm font-normal flex items-center cursor-pointer w-full">
                                    {tag.color && <span className="w-3 h-3 rounded-sm mr-2 inline-block border" style={{backgroundColor: tag.color}}></span>}
                                    {tag.name}
                                </Label>
                            </div>
                        )) : <p className="p-2 text-xs text-text-secondary">No tags available.</p>}
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

      <div className="mb-6">
        <div className="border-b border-border-secondary">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
            {statusFilters.map((status) => (
              <button
                key={status} onClick={() => setFilterStatus(status)} aria-label={`Filter by status: ${status.replace('_', ' ')}`}
                className={`${ filterStatus === status ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-primary'} whitespace-nowrap py-3 px-2 sm:px-3 border-b-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 rounded-t-md`}
              >
                {status.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {isLoadingQuests && <div className="text-center py-10 text-text-secondary"><Loader2 className="mx-auto h-6 w-6 animate-spin"/> Loading quests...</div>}

      {!isLoadingQuests && quests.length === 0 && (
        <div className="p-6 text-center bg-bg-card border border-border-secondary rounded-lg">
          <p className="text-text-secondary">No quests found for the current filters.</p>
        </div>
      )}

      {!isLoadingQuests && quests.length > 0 && (
        <div className="space-y-4">
          {quests.map((quest) => {
            const styles = questStatusStyles[quest.status] || questStatusStyles[QuestStatus.PENDING];
            return (
              <div key={quest.id} className={`p-4 rounded-lg shadow-sm border bg-bg-card ${styles.border} focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800`}>
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow mb-2 sm:mb-0">
                        <h2 className={`text-lg font-semibold text-text-primary mb-1`}>{quest.title}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badgeBg} ${styles.badgeText} border ${styles.border}`}>
                                {quest.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                {quest.type.replace('_', ' ')}
                            </span>
                            {quest.tags && quest.tags.map(tag => (
                                <span key={tag.id} className="text-xs font-medium px-2 py-0.5 rounded-full border border-border-secondary" style={{ backgroundColor: tag.color || 'var(--color-border-secondary)', color: tag.color ? (parseInt(tag.color.substring(1), 16) > 0xffffff / 2 ? 'var(--color-text-primary)' : 'var(--color-text-on-primary)') : 'var(--color-text-secondary)'}}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0 mt-2 sm:mt-0">
                        <Button variant="default" size="sm" aria-label={`Edit quest ${quest.title}`} onClick={() => handleOpenEditQuestModal(quest)} className="text-xs">Edit</Button>
                        <Button variant="destructive" size="sm" aria-label={`Delete quest ${quest.title}`} onClick={() => handleDeleteQuest(quest.id)} className="text-xs">Delete</Button>
                    </div>
                </div>
                {quest.description && <p className={`mt-2 text-sm text-text-secondary opacity-90`}>{quest.description}</p>}

                {quest.dependencies && quest.dependencies.length > 0 && quest.status !== QuestStatus.COMPLETED && quest.status !== QuestStatus.FAILED && quest.status !== QuestStatus.CANCELLED && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-0.5 text-text-secondary opacity-80">
                      <span>Progress</span>
                      <span>
                        {quest.dependencies.filter(d => d.isCompleted).length} / {quest.dependencies.length}
                      </span>
                    </div>
                    <ProgressBar
                      currentValue={quest.dependencies.filter(d => d.isCompleted).length}
                      maxValue={quest.dependencies.length}
                      heightClass="h-2"
                      colorClass={styles.progressBg}
                    />
                  </div>
                )}

                {quest.dependencies && quest.dependencies.length > 0 && (
                  <div className="mt-2">
                    <details className="group">
                      <summary className={`text-xs font-medium cursor-pointer text-text-secondary opacity-80 group-hover:opacity-100`}>
                        Dependencies ({quest.dependencies.length})
                      </summary>
                      <ul className="list-disc list-inside pl-2 mt-1 space-y-0.5">
                        {quest.dependencies.map(dep => (
                          <li key={dep.id || dep.tempId} className={`text-xs text-text-secondary opacity-70 ${dep.isCompleted ? 'line-through' : ''}`}>
                            {dep.description || dep.type.replace(/_/g, ' ')}
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
