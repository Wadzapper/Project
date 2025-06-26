'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { startOfDay, formatISO, parseISO } from 'date-fns'; // For date handling

interface SleepLogData {
  id?: string; // For editing/deleting existing logs
  date: string; // YYYY-MM-DD
  hours: number;
  quality: number; // 1-5
  notes?: string | null;
}

export default function SleepLogPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const todayISO = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<SleepLogData>({
    date: todayISO,
    hours: 7, // Default
    quality: 3, // Default
    notes: '',
  });
  const [recentLogs, setRecentLogs] = useState<SleepLogData[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingExisting, setIsFetchingExisting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchSleepLogs = async (page = 1, limit = 7) => { // Fetch recent 7 logs by default
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`/api/sleep?page=${page}&limit=${limit}&sort=desc`); // API needs to support sort
      if (!response.ok) throw new Error('Failed to fetch sleep logs');
      const data = await response.json();
      setRecentLogs(data.logs.map((log: any) => ({
          ...log,
          date: new Date(log.date).toISOString().split('T')[0] // Ensure YYYY-MM-DD
      })));
    } catch (err: any) {
      setPageError(err.message);
      toast.error(err.message || "Could not load recent sleep logs.");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchRatingForDate = async (dateStr: string) => {
    if (!dateStr) return;
    setIsFetchingExisting(true);
    try {
        const targetDate = startOfDay(new Date(dateStr));
        // The API GET /api/sleep with specific date filter
        // For now, assuming the upsert nature of POST /api/sleep means we always just try to save
        // and pre-filling is for user convenience if they revisit a date.
        // A dedicated GET /api/sleep?date=YYYY-MM-DD might be better.
        // For simplicity, we'll let the user input and submit. If an entry for that date exists, API will update it.
        // We can pre-fill by fetching all logs and finding one for the date, but that's inefficient.
        // Let's assume for now that the form is for *new* entries or *editing* one selected from the list.
        // When date changes, we can try to find if a log exists in `recentLogs` to prefill.
        const existingLogForDate = recentLogs.find(log => log.date === dateStr);
        if (existingLogForDate) {
            setFormData(existingLogForDate);
        } else {
            setFormData({ date: dateStr, hours: 7, quality: 3, notes: '' });
        }

    } catch (err) {
        console.error("Error checking existing rating for date:", err);
    } finally {
        setIsFetchingExisting(false);
    }
  };


  useEffect(() => {
    if (session?.user?.id) {
      fetchSleepLogs();
    }
  }, [session]);

  useEffect(() => {
    // When the form's date changes, try to prefill from existing logs or reset.
    fetchRatingForDate(formData.date);
  }, [formData.date]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | null = value;
    if (type === 'number') {
      processedValue = value === '' ? null : (name === 'hours' ? parseFloat(value) : parseInt(value, 10));
    }
    if (name === 'date') { // When date input changes, update formData.date to trigger useEffect for prefill
        setFormData(prev => ({ ...prev, date: value }));
    } else {
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPageError(null);
    setIsSubmitting(true);

    if (formData.hours <=0 || formData.hours > 24) {
        toast.error("Hours must be between 0 and 24.");
        setIsSubmitting(false);
        return;
    }
     if (formData.quality < 1 || formData.quality > 5) {
        toast.error("Quality must be between 1 and 5.");
        setIsSubmitting(false);
        return;
    }

    try {
      const response = await fetch('/api/sleep', {
        method: 'POST', // Upsert logic is in the API
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...formData,
            // Ensure date is sent in YYYY-MM-DD, API will handle UTC conversion
            date: formData.date,
            hours: Number(formData.hours),
            quality: Number(formData.quality),
            notes: formData.notes?.trim() === '' ? null : formData.notes,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save sleep log.');
      }
      toast.success('Sleep log saved!');
      fetchSleepLogs(); // Refresh the list
      // Reset form to today's date for a new entry, or clear it
      setFormData({ date: todayISO, hours: 7, quality: 3, notes: '' });
    } catch (err: any) {
      setPageError(err.message);
      toast.error(err.message || 'Could not save sleep log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if(window.confirm("Delete this sleep log?")) {
        try {
            const res = await fetch(`/api/sleep/${logId}`, {method: 'DELETE'});
            if(!res.ok) {const err = await res.json(); throw new Error(err.error || "Failed to delete log");}
            toast.success("Sleep log deleted.");
            fetchSleepLogs();
        } catch (e: any) { toast.error(e.message); }
    }
  };

  const handleEditLog = (log: SleepLogData) => {
    setFormData({
        id: log.id,
        date: new Date(log.date).toISOString().split('T')[0],
        hours: log.hours,
        quality: log.quality,
        notes: log.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form for editing
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Sleep Log</h1>

      {pageError && <div className="p-4 mb-4 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" role="alert">{pageError}</div>}

      {/* Sleep Log Form */}
      <form onSubmit={handleSubmit} className="p-6 mb-10 bg-white rounded-lg shadow-xl dark:bg-gray-800 space-y-6 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white text-center">
            {formData.id ? 'Edit Sleep Log' : 'Log Your Sleep'} for <span className="text-indigo-500">{new Date(formData.date).toLocaleDateString('en-US', { weekday:'short', month: 'short', day: 'numeric' })}</span>
        </h2>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
          <input type="date" name="date" id="date" required value={formData.date} onChange={handleInputChange} disabled={isSubmitting || isFetchingExisting}
                 className="block w-full input-style" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hours Slept</label>
                <input type="number" step="0.1" name="hours" id="hours" required value={formData.hours} onChange={handleInputChange} disabled={isSubmitting || isFetchingExisting} className="block w-full input-style" />
            </div>
            <div>
                <label htmlFor="quality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quality (1-5)</label>
                <input type="number" min="1" max="5" name="quality" id="quality" required value={formData.quality} onChange={handleInputChange} disabled={isSubmitting || isFetchingExisting} className="block w-full input-style" />
            </div>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
          <textarea name="notes" id="notes" rows={3} value={formData.notes || ''} onChange={handleInputChange} disabled={isSubmitting || isFetchingExisting} className="block w-full input-style" />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting || isFetchingExisting}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
            {isSubmitting ? 'Saving...' : (formData.id ? 'Update Log' : 'Save Log')}
          </button>
        </div>
      </form>

      {/* Recent Sleep Logs */}
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">Recent Sleep Logs</h2>
      {isLoadingLogs ? (
        <p className="text-center dark:text-gray-300">Loading logs...</p>
      ) : recentLogs.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">No sleep logged yet.</p>
      ) : (
        <div className="space-y-4">
          {recentLogs.map(log => (
            <div key={log.id} className="p-4 bg-white rounded-lg shadow dark:bg-gray-700 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Hours: {log.hours}, Quality: {log.quality}/5</p>
                {log.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">Notes: {log.notes}</p>}
              </div>
              <div className="space-x-2">
                <button onClick={() => handleEditLog(log)} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Edit</button>
                <button onClick={() => handleDeleteLog(log.id!)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Del</button>
              </div>
            </div>
          ))}
          {/* TODO: Pagination for logs if needed */}
        </div>
      )}
    </div>
  );
}
