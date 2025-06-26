'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import HabitFormModal, { HabitFormData } from '@/components/habits/HabitFormModal';
import HabitCard from '@/components/habits/HabitCard';
import QuickLogBar from '@/components/habits/QuickLogBar'; // Already here, but good to confirm
import HabitStatsPanel from '@/components/habits/HabitStatsPanel'; // Import HabitStatsPanel
import { HabitType, HabitGoalType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Archive, Eye, EyeOff } from 'lucide-react';

// Matches the HabitCardProps and includes what the API returns
export interface HabitDisplay {
  id: string;
  name: string;
  description?: string | null;
  type: HabitType;
  goalType: HabitGoalType;
  frequency: number;
  periodInDays?: number | null;
  tags: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  currentStreak: number;    // Now directly from API
  successCount: number;   // Now directly from API
  totalLogCount: number;  // Now directly from API
  lastLoggedDate?: string | null; // From API
  loggedToday?: boolean;
  // successRate will be calculated on the client in this component
}

export default function HabitsPage() {
  const [allHabits, setAllHabits] = useState<HabitDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentHabitForModal, setCurrentHabitForModal] = useState<HabitFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For modal submissions
  const [isLogging, setIsLogging] = useState(false); // For quick log bar and card logs

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<HabitType>(HabitType.GOOD);

  const fetchHabits = useCallback(async () => {
    setIsLoading(true); // Overall page loading
    try {
      const response = await fetch('/api/habits');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch habits');
      }
      // Ensure fetched data matches HabitDisplay
      let fetchedHabits: HabitDisplay[] = await response.json();

      // Calculate successRate for each habit
      fetchedHabits = fetchedHabits.map(habit => ({
        ...habit,
        successRate: habit.totalLogCount > 0 ? (habit.successCount / habit.totalLogCount) : 0
      }));

      setAllHabits(fetchedHabits);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch habits');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const handleOpenModal = (mode: 'create' | 'edit', habit?: HabitDisplay) => {
    setModalMode(mode);
    if (mode === 'edit' && habit) {
      setCurrentHabitForModal({
        id: habit.id,
        name: habit.name,
        description: habit.description || '',
        type: habit.type,
        goalType: habit.goalType,
        frequency: habit.frequency,
        periodInDays: habit.periodInDays || 1, // Default to 1 if null
        tags: habit.tags.join(', '), // Convert array to comma-separated string for form
        archived: habit.archived,
      });
    } else {
      setCurrentHabitForModal({ // Default values for create mode
        name: '',
        description: '',
        type: activeTab, // Default to current tab type
        goalType: HabitGoalType.STREAK, // Default goal type
        frequency: 1, // Default frequency
        periodInDays: 1, // Default period (daily)
        tags: '',
        archived: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentHabitForModal(null);
  };

  const handleSubmitModal = async (data: HabitFormData) => {
    setIsSubmitting(true);
    const url = modalMode === 'create' ? '/api/habits' : `/api/habits/${data.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    const payload = {
      ...data,
      tags: data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
    };

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${modalMode} habit`);
      }

      toast.success(`Habit ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
      handleCloseModal();
      fetchHabits(); // Refresh the list
      // If a new habit was created and its type is different from the current tab, switch to that tab
      if (modalMode === 'create' && data.type !== activeTab) {
        setActiveTab(data.type);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/habits/${habitId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete habit');
      }
      toast.success('Habit deleted successfully!');
      fetchHabits(); // Refresh list
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogHabit = async (habitId: string, success: boolean) => {
    setIsLogging(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/habits/${habitId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, isSuccess: success }),
      });

      const responseData = await response.json(); // Try to parse JSON regardless of response.ok
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to log habit. Status: ${response.status}`);
      }

      toast.success(`Habit logged as ${success ? 'successful' : 'failed/skipped'}!`);
      // The API now returns the updated habit, so we can update it selectively
      // or just refetch all for simplicity for now.
      fetchHabits();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLogging(false);
    }
  };

  const filteredHabits = allHabits
    .filter(habit => habit.type === activeTab)
    .filter(habit => showArchived ? true : !habit.archived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort by newest first


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">My Habits</h1>
        <Button onClick={() => handleOpenModal('create')} className="flex items-center self-start sm:self-center">
          <PlusCircle className="mr-2 h-5 w-5" /> Add New Habit
        </Button>
      </div>

      {/* Tabs and Show Archived Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center border-b">
        <div className="flex mb-2 sm:mb-0">
          <Button
            variant="ghost"
            className={`py-2 px-4 font-semibold rounded-none ${activeTab === HabitType.GOOD ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab(HabitType.GOOD)}
          >
            Habit Trackers
          </Button>
          <Button
            variant="ghost"
            className={`py-2 px-4 font-semibold rounded-none ${activeTab === HabitType.BAD ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab( HabitType.BAD)}
          >
            Habit Breakers
          </Button>
        </div>
        <div className="sm:ml-auto">
            <Button variant="ghost" onClick={() => setShowArchived(!showArchived)} className="text-sm flex items-center">
                {showArchived ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
        </div>
      </div>

      {/* Placeholder Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-1">Summary (Placeholder)</h2>
          <p className="text-xs text-muted-foreground">Total Streaks: X, Habits Broken: Y, Dailies Loggable: Z</p>
        </div>
        {/* Quick Log Bar Integration */}
        <div className="md:col-span-2">
          <QuickLogBar habits={allHabits} onLogHabit={handleLogHabit} isLoading={isLogging} />
        </div>
      </div>

      <div className="my-6"> {/* Container for the stats panel */}
        <HabitStatsPanel
          // Pass only habits relevant to the active tab for the selector inside the panel
          habitsInCurrentView={filteredHabits}
          activeFilterType={activeTab} // Pass current tab filter (GOOD/BAD)
        />
      </div>

      {/* Habits Display */}
      {isLoading ? (
        <div className="text-center py-10"><p className="text-lg text-muted-foreground">Loading habits...</p></div>
      ) : filteredHabits.length === 0 ? (
        <div className="text-center py-10 min-h-[200px] flex flex-col justify-center items-center bg-muted/30 rounded-lg">
          <p className="text-lg font-semibold text-muted-foreground">
            No {activeTab === HabitType.GOOD ? 'trackers' : 'breakers'} to display.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {allHabits.filter(h => h.type === activeTab).length > 0
              ? (showArchived ? `All ${activeTab === HabitType.GOOD ? 'trackers' : 'breakers'} are archived.` : `Try "Show Archived" or add a new one!`)
              : `Create a new ${activeTab === HabitType.GOOD ? 'tracker' : 'breaker'} to get started!`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              {...habit} // This now includes currentStreak, and the calculated successRate
              // Ensure successRate is explicitly passed if not directly part of HabitDisplay,
              // but the map function above adds it to the habit object being spread.
              successRate={habit.totalLogCount > 0 ? (habit.successCount / habit.totalLogCount) : 0} // Explicitly pass calculated successRate
              onEdit={() => handleOpenModal('edit', habit)}
              onDelete={() => handleDeleteHabit(habit.id)}
              onLog={handleLogHabit}
            />
          ))}
        </div>
      )}

      {isModalOpen && currentHabitForModal && (
        <HabitFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSubmitModal}
          initialData={currentHabitForModal}
          mode={modalMode}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
