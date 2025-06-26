'use client';

import { useEffect, useState } from 'react';

interface Rating {
  id: string;
  date: string; // ISO string
  productivity: number;
  mood: number;
  energy: number;
  stress?: number | null;
  focus?: number | null;
  notes?: string | null;
}

interface RecentRatingsDisplayProps {
  userId: string;
  // This component could also take a `refreshTrigger` prop if DailyRatingForm
  // doesn't cause a full page/parent component refresh that would re-trigger its own fetch.
  // For now, assuming JournalPage re-fetches or this component fetches on its own interval/trigger.
}

export default function RecentRatingsDisplay({ userId }: RecentRatingsDisplayProps) {
  const [recentRatings, setRecentRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentRatings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); // Get ratings for the last 7 days (today + 6 previous)

        const startDate = sevenDaysAgo.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        const response = await fetch(`/api/ratings?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch recent ratings');
        }
        const data: Rating[] = await response.json();
        // Sort by date descending for display, API returns ascending for charts
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecentRatings(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching recent ratings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchRecentRatings();
      // TODO: Consider a mechanism to refresh this if DailyRatingForm saves a new rating for today.
      // For now, it fetches on mount. A page refresh after saving rating would update this.
    }
  }, [userId]);

  if (isLoading) return <p className="text-sm text-center text-gray-500 dark:text-gray-400">Loading recent ratings...</p>;
  if (error) return <p className="text-sm text-center text-red-500 dark:text-red-400">Error loading ratings: {error}</p>;
  if (recentRatings.length === 0) return <p className="text-sm text-center text-gray-500 dark:text-gray-400">No ratings recorded in the last 7 days.</p>;

  return (
    <div className="mt-8 p-4 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Daily Ratings (Last 7 Days)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-2">Date</th>
              <th scope="col" className="px-4 py-2 text-center">Prod.</th>
              <th scope="col" className="px-4 py-2 text-center">Mood</th>
              <th scope="col" className="px-4 py-2 text-center">Energy</th>
              <th scope="col" className="px-4 py-2 text-center">Stress</th>
              <th scope="col" className="px-4 py-2 text-center">Focus</th>
              {/* <th scope="col" className="px-4 py-2">Notes</th> */}
            </tr>
          </thead>
          <tbody>
            {recentRatings.map(rating => (
              <tr key={rating.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  {new Date(rating.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-4 py-2 text-center">{rating.productivity}</td>
                <td className="px-4 py-2 text-center">{rating.mood}</td>
                <td className="px-4 py-2 text-center">{rating.energy}</td>
                <td className="px-4 py-2 text-center">{rating.stress ?? '-'}</td>
                <td className="px-4 py-2 text-center">{rating.focus ?? '-'}</td>
                {/* <td className="px-4 py-2 truncate max-w-xs">{rating.notes}</td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
