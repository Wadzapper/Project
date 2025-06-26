'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QuestFormModal, { QuestFormData, QuestDependencyFormData } from '@/components/quests/QuestFormModal';
import { Skill } from '@/app/skills/page';
import { QuestStatus, QuestType, QuestDependencyType, UserAchievement as PrismaUserAchievement } from '@prisma/client';
import ProgressBar from '@/components/ui/ProgressBar';
import toast from 'react-hot-toast'; // Import toast

// Define UserAchievement with nested Achievement details for toast
interface UserAchievementWithDetails extends PrismaUserAchievement {
    achievement: {
        name: string;
        icon?: string | null;
    };
}


export type QuestDisplay = {
  id: string;
  name: string;
  description: string | null;
  status: QuestStatus;
  type: QuestType;
  createdAt: string;
  dependencies: QuestDependencyFormData[];
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<QuestDisplay[]>([]);
  const [isLoadingQuests, setIsLoadingQuests] = useState(true);
  const [filterStatus, setFilterStatus] = useState<QuestStatus>(QuestStatus.IN_PROGRESS);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentQuestForModal, setCurrentQuestForModal] = useState<QuestFormData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const fetchQuests = async (status: QuestStatus) => {
    setIsLoadingQuests(true);
    setPageMessage(null);
    try {
      const response = await fetch(`/api/quests?status=${status}`);
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
  };

  const fetchUserSkills = async () => {
    try {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Failed to fetch user skills for quest form');
      const data = await response.json();
      setUserSkills(data);
    } catch (error) {
      console.error(error);
      // Optionally set a page message if skills are crucial and fail to load
    }
  };

  useEffect(() => {
    fetchQuests(filterStatus);
    fetchUserSkills(); // Fetch skills for the modal
  }, [filterStatus]);

  const handleOpenCreateQuestModal = () => {
    setModalMode('create');
    setCurrentQuestForModal(null); // Important to reset for create
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseQuestModal = () => {
    setIsModalOpen(false);
    setCurrentQuestForModal(null);
    setFormError(null);
  };

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
      fetchQuests(filterStatus); // Re-fetch current filter
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
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
        fetchQuests(filterStatus); // Re-fetch current filter
        router.refresh();
      } catch (error: any) {
        setPageMessage({ type: 'error', text: error.message });
      }
    }
  };

  const handleOpenEditQuestModal = (quest: QuestDisplay) => {
    setModalMode('edit');
    // Map QuestDisplay to QuestFormData for the modal
    // Ensure dependencies are mapped correctly, including tempId for keys if needed
    const formData: QuestFormData = {
        id: quest.id,
        name: quest.name,
        description: quest.description || '',
        type: quest.type,
        status: quest.status,
        dependencies: quest.dependencies.map(dep => ({
            ...dep,
            tempId: dep.id || crypto.randomUUID(), // Use existing ID or generate temp
            targetDate: dep.targetDate ? dep.targetDate.split('T')[0] : null, // Format for date input
        }))
    };
    setCurrentQuestForModal(formData);
    setFormError(null);
    setIsModalOpen(true);
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
        <div className="border-b border-gray-200 dark:border-gray-700">
          {/* Added focus-visible styles for accessibility */}
          <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
            {statusFilters.map((status) => (
              <button
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

      {isLoadingQuests ? (
        <div className="text-center py-10">Loading quests...</div>
      ) : quests.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-md dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">No quests found for status "{filterStatus.replace('_', ' ')}".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quests.map((quest) => {
            const colors = questStatusColors[quest.status] || questStatusColors[QuestStatus.PENDING];
            return (
              // Added focus-visible to the quest card container for keyboard navigation if it becomes interactive
              <div key={quest.id} className={`p-4 rounded-lg shadow-sm border ${colors.bg} ${colors.border} focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800`}>
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow mb-2 sm:mb-0">
                        <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{quest.name}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                                {quest.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                                {quest.type.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0 mt-2 sm:mt-0">
                        <button aria-label={`Edit quest ${quest.name}`} onClick={() => handleOpenEditQuestModal(quest)} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Edit</button>
                        <button aria-label={`Delete quest ${quest.name}`} onClick={() => handleDeleteQuest(quest.id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Delete</button>
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
