'use client';

import { useState, useEffect, FormEvent } from 'react';
import toast from 'react-hot-toast';

interface DailyRatingData {
  date: string; // YYYY-MM-DD
  productivity: number;
  mood: number;
  energy: number;
  stress?: number | null;
  focus?: number | null;
  notes?: string | null;
}

interface DailyRatingFormProps {
  userId: string; // Needed for fetching existing rating for a date
  onRatingSaved?: (savedRating: DailyRatingData) => void; // Optional callback
  initialDate?: string; // YYYY-MM-DD, defaults to today
}

const RATING_MIN = 1;
const RATING_MAX = 5;

export default function DailyRatingForm({ userId, onRatingSaved, initialDate }: DailyRatingFormProps) {
  const todayISO = new Date().toISOString().split('T')[0];
  const [ratingData, setRatingData] = useState<DailyRatingData>({
    date: initialDate || todayISO,
    productivity: 3, // Default mid-value
    mood: 3,
    energy: 3,
    stress: null,
    focus: null,
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingExisting, setIsFetchingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter(); // For router.refresh()

  // Fetch existing rating when date changes
  useEffect(() => {
    const fetchExistingRating = async () => {
      if (!ratingData.date) return;
      setIsFetchingExisting(true);
      setError(null);
      try {
        const startDate = new Date(ratingData.date);
        startDate.setUTCHours(0,0,0,0);
        const endDate = new Date(ratingData.date); // Use same date for single day fetch
        // The API should handle fetching a single day's rating based on the 'date' field.
        // For more robust single day fetching, API might need a specific param or the GET /api/ratings
        // logic needs to be precise for single day when startDate and endDate are the same.
        // Let's assume API GET handles ?date=YYYY-MM-DD or the range correctly for one day.
        // For now, using the range as implemented in DailyRatingForm
        const response = await fetch(`/api/ratings?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`);

        if (response.ok) {
          const ratingsForDay: DailyRatingData[] = await response.json();
          if (ratingsForDay.length > 0) {
            const existing = ratingsForDay[0];
            setRatingData({
                date: new Date(existing.date).toISOString().split('T')[0],
                productivity: existing.productivity,
                mood: existing.mood,
                energy: existing.energy,
                stress: existing.stress,
                focus: existing.focus,
                notes: existing.notes || '',
            });
          } else {
            setRatingData(prev => ({
                date: prev.date,
                productivity: 3, mood: 3, energy: 3, stress: null, focus: null, notes: ''
            }));
          }
        } else {
          console.warn("Failed to fetch existing rating for date:", ratingData.date);
           setRatingData(prev => ({
                date: prev.date, productivity: 3, mood: 3, energy: 3, stress: null, focus: null, notes: ''
            }));
        }
      } catch (err) {
        console.error("Error fetching existing rating:", err);
      } finally {
        setIsFetchingExisting(false);
      }
    };
    fetchExistingRating();
  }, [ratingData.date, userId]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | null = value;
    if (type === 'number') {
      processedValue = value === '' ? null : parseInt(value, 10);
      if (processedValue !== null && (processedValue < RATING_MIN || processedValue > RATING_MAX)) {
        // Could show inline error or just clamp, for now allow input for user to see
      }
    }
    setRatingData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate ratings are within bounds before submit
    const fieldsToValidate: (keyof DailyRatingData)[] = ['productivity', 'mood', 'energy', 'stress', 'focus'];
    for (const field of fieldsToValidate) {
        const value = ratingData[field] as number | undefined | null;
        if (value !== undefined && value !== null && (value < RATING_MIN || value > RATING_MAX)) {
            setError(`Invalid value for ${field}. Must be between ${RATING_MIN} and ${RATING_MAX}.`);
            setIsLoading(false);
            return;
        }
    }

    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...ratingData,
            // Ensure optional fields are null if empty string or not set, API handles this.
            stress: ratingData.stress === undefined ? null : Number(ratingData.stress) || null,
            focus: ratingData.focus === undefined ? null : Number(ratingData.focus) || null,
            notes: ratingData.notes?.trim() === '' ? null : ratingData.notes,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save rating.');
      }
      const savedRating = await response.json();
      toast.success('Daily rating saved!');
      if (onRatingSaved) {
        onRatingSaved(savedRating);
      }
      router.refresh(); // Refresh server components and re-run client effects on page
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Could not save rating.');
    } finally {
      setIsLoading(false);
    }
  };

  const ratingFields: { name: keyof DailyRatingData, label: string, optional?: boolean }[] = [
      { name: 'productivity', label: 'Productivity' },
      { name: 'mood', label: 'Mood' },
      { name: 'energy', label: 'Energy' },
      { name: 'stress', label: 'Stress (Optional)', optional: true },
      { name: 'focus', label: 'Focus (Optional)', optional: true },
  ];

  return (
    <div className="p-6 my-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="mb-6 text-2xl font-semibold text-center text-gray-900 dark:text-white">
        How was your day?
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
          <input type="date" name="date" id="date" required value={ratingData.date} onChange={handleInputChange} disabled={isLoading || isFetchingExisting}
                 className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {ratingFields.map(field => (
                <div key={field.name}>
                    <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                    <input type="number" name={field.name} id={field.name}
                           value={ratingData[field.name] === null || ratingData[field.name] === undefined ? '' : String(ratingData[field.name])}
                           onChange={handleInputChange}
                           min={RATING_MIN} max={RATING_MAX}
                           required={!field.optional}
                           disabled={isLoading || isFetchingExisting}
                           className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
                </div>
            ))}
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
          <textarea name="notes" id="notes" rows={3} value={ratingData.notes || ''} onChange={handleInputChange} disabled={isLoading || isFetchingExisting}
                    className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={isLoading || isFetchingExisting}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
            {isLoading ? 'Saving...' : (isFetchingExisting ? 'Loading...' : 'Save Rating')}
          </button>
        </div>
      </form>
    </div>
  );
}
