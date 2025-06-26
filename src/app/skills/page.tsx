'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SkillFormModal, { SkillFormData } from '@/components/skills/SkillFormModal';
import AddXpModal from '@/components/skills/AddXpModal';
import { calculateLevelUp, recalculateSkillStats, SkillLevelInfo, getSkillColorClass } from '@/lib/skillUtils';
import ProgressBar from '@/components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { UserAchievement as PrismaUserAchievement } from '@prisma/client'; // For typing API response

// Define UserAchievement with nested Achievement details for toast
interface UserAchievementWithDetails extends PrismaUserAchievement {
    achievement: {
        name: string;
        icon?: string | null;
        // add other fields if needed for the toast
    };
}

export type Skill = {
  id: string;
  name: string;
  description: string | null;
  currentLevel: number;
  currentXp: number;
  targetXpForNextLevel: number;
  createdAt: string;
  userId: string;
  colorCode?: string | null;
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentSkillForModal, setCurrentSkillForModal] = useState<SkillFormData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [isAddXpModalOpen, setIsAddXpModalOpen] = useState(false);
  const [skillForXpAdd, setSkillForXpAdd] = useState<Skill | null>(null);
  const [addXpFormError, setAddXpFormError] = useState<string | null>(null);
  const [isSubmittingXp, setIsSubmittingXp] = useState(false);

  const router = useRouter();

  const fetchSkills = async () => {
    setIsLoadingSkills(true);
    try {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Failed to fetch skills');
      const data = await response.json();
      setSkills(data);
    } catch (error) { console.error(error); setPageMessage({type: 'error', text: 'Could not load skills.'});}
    finally { setIsLoadingSkills(false); }
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    const initialStats = recalculateSkillStats(1, 0);
    setCurrentSkillForModal({
      name: '', description: '',
      currentLevel: initialStats.currentLevel,
      currentXp: initialStats.currentXp,
      targetXpForNextLevel: initialStats.targetXpForNextLevel
    });
    setFormError(null); setIsModalOpen(true);
  };

  const handleOpenEditModal = (skill: Skill) => {
    setModalMode('edit');
    setCurrentSkillForModal({
      id: skill.id, name: skill.name, description: skill.description || '',
      currentLevel: skill.currentLevel, currentXp: skill.currentXp,
      targetXpForNextLevel: skill.targetXpForNextLevel,
    });
    setFormError(null); setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setCurrentSkillForModal(null); setFormError(null);};

  const handleSubmitSkill = async (skillDataFromForm: SkillFormData) => {
    setIsSubmitting(true); setFormError(null); setPageMessage(null);
    let dataToSubmit: Partial<SkillFormData> & { name: string };

    if (modalMode === 'create') {
        const initialStats = recalculateSkillStats(1, 0);
        dataToSubmit = {
            name: skillDataFromForm.name,
            description: skillDataFromForm.description || '',
            currentLevel: initialStats.currentLevel,
            currentXp: initialStats.currentXp,
            targetXpForNextLevel: initialStats.targetXpForNextLevel,
        };
    } else {
        dataToSubmit = { ...skillDataFromForm };
        const originalSkill = skills.find(s => s.id === skillDataFromForm.id);
        if (originalSkill && (originalSkill.currentLevel !== skillDataFromForm.currentLevel || originalSkill.currentXp !== skillDataFromForm.currentXp)) {
            const recalculated = recalculateSkillStats(skillDataFromForm.currentLevel, skillDataFromForm.currentXp);
            dataToSubmit.currentLevel = recalculated.currentLevel;
            dataToSubmit.currentXp = recalculated.currentXp;
            dataToSubmit.targetXpForNextLevel = recalculated.targetXpForNextLevel;
        } else if (originalSkill) {
            dataToSubmit.targetXpForNextLevel = calculateLevelUp(originalSkill, 0).targetXpForNextLevel;
        }
    }

    const url = modalMode === 'create' ? '/api/skills' : `/api/skills/${skillDataFromForm.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSubmit) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Failed to ${modalMode} skill`); }

      const responseData: { updatedSkill: Skill, unlockedAchievements: UserAchievementWithDetails[] } = await response.json();

      setPageMessage({type: 'success', text: `Skill ${modalMode}ed successfully!`});
      if (responseData.unlockedAchievements && responseData.unlockedAchievements.length > 0) {
        responseData.unlockedAchievements.forEach(ua => {
          toast.success(`Achievement Unlocked: ${ua.achievement.icon || '🏆'} ${ua.achievement.name}!`, { duration: 5000 });
        });
      }

      handleCloseModal(); fetchSkills(); router.refresh();
    } catch (error: any) { setFormError(error.message || 'An unexpected error occurred.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteSkill = async (skillId: string) => {
    setPageMessage(null);
    if (window.confirm('Delete this skill?')) {
      try {
        const response = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to delete skill');}
        setPageMessage({ type: 'success', text: 'Skill deleted.' });
        fetchSkills(); router.refresh();
      } catch (error: any) { setPageMessage({ type: 'error', text: error.message });}
    }
  };

  const handleOpenAddXpModal = (skill: Skill) => { setSkillForXpAdd(skill); setAddXpFormError(null); setIsAddXpModalOpen(true); };
  const handleCloseAddXpModal = () => { setIsAddXpModalOpen(false); setSkillForXpAdd(null); setAddXpFormError(null); };

  const handleSubmitAddXp = async (xpToAdd: number) => {
    if (!skillForXpAdd) return;
    setIsSubmittingXp(true); setAddXpFormError(null); setPageMessage(null);

    const currentSkillStats: SkillLevelInfo = {
      currentLevel: skillForXpAdd.currentLevel,
      currentXp: skillForXpAdd.currentXp,
      targetXpForNextLevel: skillForXpAdd.targetXpForNextLevel,
    };
    const updatedStats = calculateLevelUp(currentSkillStats, xpToAdd);

    try {
      const response = await fetch(`/api/skills/${skillForXpAdd.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentXp: updatedStats.currentXp,
          currentLevel: updatedStats.currentLevel,
          targetXpForNextLevel: updatedStats.targetXpForNextLevel,
        }),
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to add XP');}

      const responseData: { updatedSkill: Skill, unlockedAchievements: UserAchievementWithDetails[] } = await response.json();

      setPageMessage({ type: 'success', text: `${xpToAdd} XP added to ${skillForXpAdd.name}!` });
      if (responseData.unlockedAchievements && responseData.unlockedAchievements.length > 0) {
        responseData.unlockedAchievements.forEach(ua => {
          toast.success(`Achievement Unlocked: ${ua.achievement.icon || '🏆'} ${ua.achievement.name}!`, { duration: 5000 });
        });
      }
      handleCloseAddXpModal(); fetchSkills(); router.refresh();
    } catch (error: any) { setAddXpFormError(error.message); }
    finally { setIsSubmittingXp(false); }
  };

  if (isLoadingSkills) return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Skills</h1>
        <button onClick={handleOpenCreateModal} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600">
          + Add New Skill
        </button>
      </div>

      {pageMessage && <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}role="alert">{pageMessage.text}</div>}

      {skills.length === 0 && !isLoadingSkills ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-md dark:bg-gray-800"><p className="text-gray-600 dark:text-gray-400">No skills yet. Add one!</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => {
            const colorClass = getSkillColorClass(skill.currentLevel);
            return (
              <div
                key={skill.id}
                className={`p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col justify-between ${colorClass}`}
              >
                <div>
                  <h2 className="text-xl font-semibold mb-2">{skill.name}</h2>
                  <p className="text-sm opacity-90 mb-1">Lvl: {skill.currentLevel}</p>
                <div className="mb-1">
                  <p className="text-xs opacity-90">
                    XP: {skill.currentXp} / {skill.targetXpForNextLevel}
                  </p>
                  <ProgressBar
                    currentValue={skill.currentXp}
                    maxValue={skill.targetXpForNextLevel}
                    heightClass="h-1.5 mt-0.5"
                    colorClass="bg-yellow-400"
                  />
                </div>
                {skill.description && <p className="text-sm opacity-90 my-2 truncate">{skill.description}</p>}
                </div>
              <div className="mt-auto">
                  <div className="text-xs opacity-80 mb-2">Added: {new Date(skill.createdAt).toLocaleDateString()}</div>
                  <div className="flex justify-end space-x-2">
                     <button onClick={() => handleOpenAddXpModal(skill)} className="px-3 py-1 text-xs text-white bg-black bg-opacity-20 rounded hover:bg-opacity-30">+XP</button>
                    <button onClick={() => handleOpenEditModal(skill)} className="px-3 py-1 text-xs text-white bg-black bg-opacity-20 rounded hover:bg-opacity-30">Edit</button>
                    <button onClick={() => handleDeleteSkill(skill.id)} className="px-3 py-1 text-xs text-white bg-black bg-opacity-20 rounded hover:bg-opacity-30">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SkillFormModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmitSkill} initialData={currentSkillForModal} mode={modalMode} isLoading={isSubmitting} error={formError}/>
      {skillForXpAdd && <AddXpModal isOpen={isAddXpModalOpen} onClose={handleCloseAddXpModal} onSubmit={handleSubmitAddXp} skillName={skillForXpAdd.name} isLoading={isSubmittingXp} error={addXpFormError}/>}
    </div>
  );
}
