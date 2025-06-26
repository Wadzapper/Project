'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { WorkoutType } from '@prisma/client';
import WorkoutSessionCard from '@/components/workouts/WorkoutSessionCard';
import WorkoutFormModal /*, { WorkoutFormData }*/ from '@/components/workouts/WorkoutFormModal'; // Placeholder for WorkoutFormData

// Types for display
export interface SetLogDisplay {
  id: string;
  setNumber: number;
  reps: number;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}
export interface ExerciseEntryDisplay {
  id: string;
  name: string;
  notes?: string | null;
  sets: SetLogDisplay[];
  durationMinutes?: number | null;
  distanceKm?: number | null;
  caloriesBurned?: number | null;
  order?: number | null;
}
export interface WorkoutSessionDisplay {
  id: string;
  date: string; // ISO string
  type: WorkoutType;
  notes?: string | null;
  exerciseLogs: ExerciseEntryDisplay[];
  createdAt: string;
}

// Placeholder for the detailed form data type
export interface WorkoutFormData {
    id?: string;
    date: string;
    type: WorkoutType;
    notes?: string;
    exercises: Array<{
        id?: string; // For existing exercises during edit
        tempId?: string; // For new exercises before saving
        name: string;
        notes?: string;
        order: number;
        sets: Array<{
            id?: string; // For existing sets
            tempId?: string; // For new sets
            setNumber: number;
            reps: number;
            weightKg?: number | null;
            restSeconds?: number | null;
            notes?: string;
        }>;
        durationMinutes?: number | null;
        distanceKm?: number | null;
        caloriesBurned?: number | null;
    }>;
}


export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSessionDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentWorkoutForModal, setCurrentWorkoutForModal] = useState<WorkoutFormData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const fetchWorkoutSessions = async (page = 1) => {
    setIsLoading(true);
    setPageMessage(null);
    try {
      const response = await fetch(`/api/workouts?page=${page}&limit=10`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch workout sessions');
      }
      const data = await response.json();
      setSessions(data.sessions);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (error: any) {
      console.error(error);
      setPageMessage({ type: 'error', text: error.message || 'Could not load workout sessions.' });
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkoutSessions(currentPage);
  }, [currentPage]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    // Initialize with a default structure for WorkoutFormData
    setCurrentWorkoutForModal({
        date: new Date().toISOString().split('T')[0], // Default to today
        type: WorkoutType.STRENGTH, // Default type
        notes: '',
        exercises: [],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sessionData: WorkoutSessionDisplay) => {
    setModalMode('edit');
    // Map WorkoutSessionDisplay to WorkoutFormData
    const formData: WorkoutFormData = {
        id: sessionData.id,
        date: new Date(sessionData.date).toISOString(), // Ensure full ISO for datetime-local or consistent handling
        type: sessionData.type,
        notes: sessionData.notes || '',
        exercises: sessionData.exerciseLogs.map((ex, exIndex) => ({
            id: ex.id,
            name: ex.name,
            notes: ex.notes || '',
            order: ex.order ?? exIndex,
            sets: ex.sets.map((set, setIndex) => ({
                id: set.id,
                setNumber: set.setNumber,
                reps: set.reps,
                weightKg: set.weightKg,
                restSeconds: set.restSeconds,
                notes: set.notes || '',
            })),
            durationMinutes: ex.durationMinutes,
            distanceKm: ex.distanceKm,
            caloriesBurned: ex.caloriesBurned,
        }))
    };
    setCurrentWorkoutForModal(formData);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentWorkoutForModal(null);
    setFormError(null);
  };

  const handleSubmitWorkout = async (workoutData: WorkoutFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    setPageMessage(null);

    const url = modalMode === 'create' ? '/api/workouts' : `/api/workouts/${workoutData.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${modalMode} workout`);
      }
      toast.success(`Workout session ${modalMode === 'create' ? 'logged' : 'updated'} successfully!`);
      handleCloseModal();
      fetchWorkoutSessions(modalMode === 'create' ? 1 : currentPage); // Go to first page on create
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
      toast.error(error.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Are you sure you want to delete this workout session?")) {
        try {
            const res = await fetch(`/api/workouts/${sessionId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to delete session");
            }
            toast.success("Workout session deleted!");
            fetchWorkoutSessions(currentPage);
        } catch (e: any) {
            toast.error(e.message || "Could not delete session.");
        }
    }
  };

  if (isLoading && sessions.length === 0) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading workout sessions...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Workouts</h1>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          aria-label="Log New Workout"
        >
          + Log New Workout
        </button>
      </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}role="alert">
          {pageMessage.text}
        </div>
      )}

      {sessions.length === 0 && !isLoading ? (
        <div className="p-10 text-center bg-white rounded-lg shadow-md dark:bg-gray-800">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No Workouts Logged Yet</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Start logging your workouts to see them here!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => (
            <WorkoutSessionCard
                key={session.id}
                session={session}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteSession}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center space-x-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <=1 || isLoading} className="px-3 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage >= totalPages || isLoading} className="px-3 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 disabled:opacity-50">Next</button>
        </div>
      )}

      <WorkoutFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitWorkout}
        initialData={currentWorkoutForModal}
        mode={modalMode}
        isLoading={isSubmitting}
        error={formError}
      />
    </div>
  );
}
