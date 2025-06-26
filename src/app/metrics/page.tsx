'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { formatISO, parseISO } from 'date-fns';

interface BodyMetricData {
  id?: string;
  date: string; // ISO string YYYY-MM-DDTHH:mm
  weightKg?: number | null;
  bodyFat?: number | null;
  notes?: string | null;
}

export default function BodyMetricsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const nowISO = new Date().toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm
  const [formData, setFormData] = useState<BodyMetricData>({
    date: nowISO,
    weightKg: null,
    bodyFat: null,
    notes: '',
  });
  const [recentMetrics, setRecentMetrics] = useState<BodyMetricData[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);


  const fetchBodyMetrics = async (page = 1, limit = 10) => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch(`/api/metrics?page=${page}&limit=${limit}&sort=desc`);
      if (!response.ok) throw new Error('Failed to fetch body metrics');
      const data = await response.json();
      setRecentMetrics(data.metrics.map((m: any) => ({
          ...m,
          date: new Date(m.date).toISOString().substring(0,16) // Format for datetime-local
      })));
      // Add pagination state if needed: setCurrentPage(data.currentPage), setTotalPages(data.totalPages)
    } catch (err: any) {
      setPageError(err.message);
      toast.error(err.message || "Could not load recent metrics.");
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchBodyMetrics();
    }
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | null = value;
    if (type === 'number') {
      processedValue = value === '' ? null : parseFloat(value);
    }
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPageError(null);
    setIsSubmitting(true);

    if (!formData.weightKg && !formData.bodyFat) {
        toast.error("Please enter at least one metric (Weight or Body Fat).");
        setIsSubmitting(false);
        return;
    }

    const apiData = {
        ...formData,
        date: new Date(formData.date).toISOString(), // Ensure full ISO for backend
        weightKg: formData.weightKg ? Number(formData.weightKg) : null,
        bodyFat: formData.bodyFat ? Number(formData.bodyFat) : null,
        notes: formData.notes?.trim() === '' ? null : formData.notes,
    };

    const url = editingMetricId ? `/api/metrics/${editingMetricId}` : '/api/metrics';
    const method = editingMetricId ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save body metric.`);
      }
      toast.success(`Body metric ${editingMetricId ? 'updated' : 'saved'}!`);
      fetchBodyMetrics();
      setFormData({ date: nowISO, weightKg: null, bodyFat: null, notes: '' }); // Reset form
      setEditingMetricId(null); // Clear editing state
    } catch (err: any) {
      setPageError(err.message);
      toast.error(err.message || 'Could not save body metric.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (metric: BodyMetricData) => {
    setEditingMetricId(metric.id!);
    setFormData({
        date: metric.date, // Already in YYYY-MM-DDTHH:mm
        weightKg: metric.weightKg,
        bodyFat: metric.bodyFat,
        notes: metric.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (metricId: string) => {
    if(window.confirm("Delete this metric entry?")) {
        try {
            const res = await fetch(`/api/metrics/${metricId}`, {method: 'DELETE'});
            if(!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to delete metric");}
            toast.success("Metric entry deleted.");
            fetchBodyMetrics();
        } catch (e: any) { toast.error(e.message); }
    }
  };

  const handleCancelEdit = () => {
    setEditingMetricId(null);
    setFormData({ date: nowISO, weightKg: null, bodyFat: null, notes: '' });
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Body Metrics</h1>

      {pageError && <div className="p-4 mb-4 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" role="alert">{pageError}</div>}

      <form onSubmit={handleSubmit} className="p-6 mb-10 bg-white rounded-lg shadow-xl dark:bg-gray-800 space-y-6 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white text-center">
          {editingMetricId ? 'Edit Entry' : 'Log New Entry'} for {new Date(formData.date).toLocaleDateString('en-US', { weekday:'short', month: 'short', day: 'numeric', hour:'numeric', minute:'numeric' })}
        </h2>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</label>
          <input type="datetime-local" name="date" id="date" required value={formData.date} onChange={handleInputChange} disabled={isSubmitting}
                 className="block w-full input-style"/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label htmlFor="weightKg" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Weight (kg)</label>
                <input type="number" step="0.01" name="weightKg" id="weightKg" value={formData.weightKg ?? ''} onChange={handleInputChange} disabled={isSubmitting} className="block w-full input-style" />
            </div>
            <div>
                <label htmlFor="bodyFat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body Fat (%)</label>
                <input type="number" step="0.1" name="bodyFat" id="bodyFat" value={formData.bodyFat ?? ''} onChange={handleInputChange} disabled={isSubmitting} className="block w-full input-style" />
            </div>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
          <textarea name="notes" id="notes" rows={3} value={formData.notes || ''} onChange={handleInputChange} disabled={isSubmitting} className="block w-full input-style" />
        </div>
        <div className="flex justify-end space-x-3">
          {editingMetricId && (
            <button type="button" onClick={handleCancelEdit} disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
              Cancel Edit
            </button>
          )}
          <button type="submit" disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
            {isSubmitting ? 'Saving...' : (editingMetricId ? 'Update Metric' : 'Save Metric')}
          </button>
        </div>
      </form>

      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">Recent Body Metrics</h2>
      {isLoadingMetrics ? (
        <p className="text-center dark:text-gray-300">Loading metrics...</p>
      ) : recentMetrics.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">No body metrics logged yet.</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow rounded-lg">
          <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Weight (kg)</th>
                <th scope="col" className="px-4 py-3">Body Fat (%)</th>
                <th scope="col" className="px-4 py-3">Notes</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {recentMetrics.map(metric => (
                <tr key={metric.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{new Date(metric.date).toLocaleString()}</td>
                  <td className="px-4 py-3">{metric.weightKg ?? '-'}</td>
                  <td className="px-4 py-3">{metric.bodyFat ?? '-'}</td>
                  <td className="px-4 py-3 truncate max-w-xs">{metric.notes || '-'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => handleEdit(metric)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(metric.id!)} className="font-medium text-red-600 dark:text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* TODO: Pagination for metrics if needed */}
    </div>
  );
}
