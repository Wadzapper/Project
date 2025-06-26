'use client';

import { useEffect, useState, FormEvent } from 'react';
import { WorkoutType } from '@prisma/client';
import toast from 'react-hot-toast';
import { WorkoutFormData, ExerciseInput, SetInput } from '@/app/workouts/page'; // Assuming types are exported from page for now

interface WorkoutFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WorkoutFormData) => Promise<void>;
  initialData?: WorkoutFormData | null;
  mode: 'create' | 'edit';
  isLoading?: boolean;
  error?: string | null;
}

const defaultExercise = (): ExerciseInput => ({
    tempId: crypto.randomUUID(), // For client-side keying before saving
    name: '',
    notes: '',
    order: 0, // Will be set based on array index
    sets: [{ tempId: crypto.randomUUID(), setNumber: 1, reps: 0, weightKg: null, restSeconds: null, notes: '' }],
    durationMinutes: null,
    distanceKm: null,
    caloriesBurned: null,
});

const defaultSet = (setNumber: number): SetInput => ({
    tempId: crypto.randomUUID(),
    setNumber,
    reps: 0,
    weightKg: null,
    restSeconds: null,
    notes: ''
});


export default function WorkoutFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null,
}: WorkoutFormModalProps) {

  const [formData, setFormData] = useState<WorkoutFormData>(
    initialData || { date: new Date().toISOString(), type: WorkoutType.STRENGTH, exercises: [defaultExercise()] }
  );

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
            ...initialData,
            // Ensure exercises and sets have tempIds if they are new or from DB without them client-side
            exercises: initialData.exercises.map(ex => ({
                ...ex,
                tempId: ex.id || ex.tempId || crypto.randomUUID(),
                sets: ex.sets.map(set => ({
                    ...set,
                    tempId: set.id || set.tempId || crypto.randomUUID()
                }))
            }))
        });
      } else { // Create mode
        setFormData({
          date: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().split(' ')[0].substring(0,5), // YYYY-MM-DDTHH:mm
          type: WorkoutType.STRENGTH,
          notes: '',
          exercises: [defaultExercise()],
        });
      }
    }
  }, [isOpen, initialData, mode]);

  const handleSessionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'date' ? new Date(value).toISOString() : value }));
  };

  const handleExerciseChange = (exIndex: number, field: keyof ExerciseInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIndex ? { ...ex, [field]: value } : ex
      ),
    }));
  };

  const handleSetChange = (exIndex: number, setIndex: number, field: keyof SetInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIndex ? {
          ...ex,
          sets: ex.sets.map((set, si) =>
            si === setIndex ? { ...set, [field]: (field === 'reps' || field === 'restSeconds' || field === 'setNumber') ? parseInt(value) || 0 : (field === 'weightKg' ? parseFloat(value) || null : value) } : set
          )
        } : ex
      ),
    }));
  };

  const addExercise = () => {
    setFormData(prev => ({
      ...prev,
      exercises: [...prev.exercises, defaultExercise()],
    }));
  };

  const removeExercise = (exIndex: number) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== exIndex),
    }));
  };

  const addSet = (exIndex: number) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIndex ? { ...ex, sets: [...ex.sets, defaultSet(ex.sets.length + 1)] } : ex
      ),
    }));
  };

  const removeSet = (exIndex: number, setIndex: number) => {
     setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIndex ? {
          ...ex,
          sets: ex.sets.filter((_, si) => si !== setIndex).map((s, newIdx) => ({...s, setNumber: newIdx + 1})) // Re-number sets
        } : ex
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.exercises.length === 0) {
      toast.error('Please add at least one exercise.');
      return;
    }
    const processedData = {
        ...formData,
        date: new Date(formData.date).toISOString(), // Ensure it's full ISO for backend
        exercises: formData.exercises.map((ex, index) => ({
            ...ex,
            order: index, // Assign order based on array position
            // Remove tempId before sending to backend if it's a new item
            id: ex.id, // Keep id if it's an existing exercise
            sets: ex.sets.map(set => ({
                ...set,
                id: set.id, // Keep id if it's an existing set
                weightKg: set.weightKg === null || isNaN(set.weightKg as number) ? null : Number(set.weightKg),
                restSeconds: set.restSeconds === null || isNaN(set.restSeconds as number) ? null : Number(set.restSeconds),
                reps: Number(set.reps) || 0,
                setNumber: Number(set.setNumber) || 0,
            }))
        }))
    };
    // Remove tempIds from exercises and sets before submitting
    processedData.exercises.forEach(ex => {
        delete (ex as any).tempId;
        ex.sets.forEach(set => delete (set as any).tempId);
    });

    await onSubmit(processedData);
  };

  if (!isOpen) return null;

  const inputBaseClass = "block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500";
  const inputSmallClass = "block w-full px-2 py-1 mt-1 text-xs placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500";


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-3xl p-4 sm:p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Log New Workout' : 'Edit Workout Session'}
          </h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</label>
              <input type="datetime-local" name="date" id="date" required
                     value={formData.date ? new Date(formData.date).toISOString().substring(0, 16) : ''}
                     onChange={handleSessionChange} disabled={isLoading} className={inputBaseClass} />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Workout Type</label>
              <select name="type" id="type" value={formData.type} onChange={handleSessionChange} disabled={isLoading} className={inputBaseClass}>
                {Object.values(WorkoutType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Session Notes</label>
            <textarea name="notes" id="notes" rows={2} value={formData.notes || ''} onChange={handleSessionChange} disabled={isLoading} className={inputBaseClass} />
          </div>

          {/* Exercises Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Exercises</h3>
            {formData.exercises.map((exercise, exIndex) => (
              <div key={exercise.tempId || exercise.id} className="p-3 border border-gray-200 rounded-md dark:border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                  <input type="text" placeholder="Exercise Name" value={exercise.name} onChange={(e) => handleExerciseChange(exIndex, 'name', e.target.value)} required className={`flex-grow mr-2 ${inputBaseClass} text-base`} />
                  <button type="button" onClick={() => removeExercise(exIndex)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Remove Exercise</button>
                </div>
                <textarea placeholder="Exercise notes..." rows={1} value={exercise.notes || ''} onChange={(e) => handleExerciseChange(exIndex, 'notes', e.target.value)} className={`${inputSmallClass} text-xs`} />

                {/* Conditional Fields for Cardio */}
                {(formData.type === WorkoutType.CARDIO || formData.type === WorkoutType.MIXED) && !exercise.sets?.length && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                        <label className="block text-xs font-medium">Duration (min)</label>
                        <input type="number" value={exercise.durationMinutes || ''} onChange={e => handleExerciseChange(exIndex, 'durationMinutes', parseInt(e.target.value) || null)} className={inputSmallClass} />
                    </div>
                     <div>
                        <label className="block text-xs font-medium">Distance (km)</label>
                        <input type="number" step="0.1" value={exercise.distanceKm || ''} onChange={e => handleExerciseChange(exIndex, 'distanceKm', parseFloat(e.target.value) || null)} className={inputSmallClass} />
                    </div>
                     <div>
                        <label className="block text-xs font-medium">Calories Burned</label>
                        <input type="number" value={exercise.caloriesBurned || ''} onChange={e => handleExerciseChange(exIndex, 'caloriesBurned', parseInt(e.target.value) || null)} className={inputSmallClass} />
                    </div>
                  </div>
                )}

                {/* Sets Section (for STRENGTH or if sets exist for MIXED) */}
                {(formData.type === WorkoutType.STRENGTH || (formData.type === WorkoutType.MIXED && exercise.sets && exercise.sets.length > 0)) && (
                  <div className="mt-2 space-y-2 pl-4 border-l-2 border-indigo-500 dark:border-indigo-400">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sets</h4>
                    {exercise.sets.map((set, setIndex) => (
                      <div key={set.tempId || set.id} className="grid grid-cols-3 sm:grid-cols-5 gap-2 items-end text-xs">
                        <span className="sm:col-span-1 text-gray-500 dark:text-gray-400 self-center">Set {set.setNumber}</span>
                        <div className="col-span-1">
                          <label className="block text-xs">Reps</label>
                          <input type="number" value={set.reps} onChange={e => handleSetChange(exIndex, setIndex, 'reps', e.target.value)} required className={inputSmallClass} />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs">Weight (kg)</label>
                          <input type="number" step="0.01" value={set.weightKg === null ? '' : set.weightKg} onChange={e => handleSetChange(exIndex, setIndex, 'weightKg', e.target.value)} className={inputSmallClass} />
                        </div>
                         <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs">Rest (sec)</label>
                          <input type="number" value={set.restSeconds === null ? '' : set.restSeconds} onChange={e => handleSetChange(exIndex, setIndex, 'restSeconds', e.target.value)} className={inputSmallClass} />
                        </div>
                        <button type="button" onClick={() => removeSet(exIndex, setIndex)} className="text-xs text-red-500 hover:text-red-700 self-center sm:ml-auto">✕</button>
                         <div className="col-span-full mt-1">
                             <input type="text" placeholder="Set notes..." value={set.notes || ''} onChange={e => handleSetChange(exIndex, setIndex, 'notes', e.target.value)} className={`${inputSmallClass} text-xs`} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addSet(exIndex)} className="mt-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-700">
                      + Add Set
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addExercise} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
              + Add Exercise
            </button>
          </div>

          <div className="pt-6 space-x-3 text-right border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Log Workout' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
