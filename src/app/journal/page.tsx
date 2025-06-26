'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import JournalEntryCard from '@/components/journal/JournalEntryCard';
import JournalEntryFormModal, { JournalEntryFormData } from '@/components/journal/JournalEntryFormModal';
import DailyRatingForm from '@/components/ratings/DailyRatingForm';
import RecentRatingsDisplay from '@/components/ratings/RecentRatingsDisplay'; // Import RecentRatingsDisplay
import { useSession } from 'next-auth/react';


export interface JournalEntryDisplay {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  tags: string[];
  createdAt: string;
  // linkedSkillIds?: string[];
  // linkedQuestIds?: string[];
  // linkedAchievementIds?: string[];
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Modal State (to be used with JournalEntryFormModal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentEntryForModal, setCurrentEntryForModal] = useState<any | null>(null); // Will be JournalEntryFormData
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  // sessionStatus can be 'loading', 'authenticated', 'unauthenticated'

  const fetchJournalEntries = async () => {
    setIsLoading(true);
    setPageMessage(null);
    try {
      const response = await fetch('/api/journal'); // Add filters later if needed
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch journal entries');
      }
      const data: JournalEntryDisplay[] = await response.json();
      setEntries(data);
    } catch (error: any) {
      console.error(error);
      setPageMessage({ type: 'error', text: error.message || 'Could not load journal entries.' });
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    const defaultDate = new Date().toISOString().split('T')[0];
    setCurrentEntryForModal({ title: '', content: '', date: defaultDate, tags: [] });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry: JournalEntryDisplay) => {
    setModalMode('edit');
    setCurrentEntryForModal({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        date: new Date(entry.date).toISOString().split('T')[0], // Ensure YYYY-MM-DD
        tags: entry.tags || [],
        // linkedSkillIds: entry.linkedSkillIds || [], // Add if these become part of form
        // linkedQuestIds: entry.linkedQuestIds || [],
        // linkedAchievementIds: entry.linkedAchievementIds || [],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentEntryForModal(null);
    setFormError(null);
  };

  const handleSubmitEntry = async (formData: JournalEntryFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    setPageMessage(null);

    const url = modalMode === 'create' ? '/api/journal' : `/api/journal/${formData.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${modalMode} journal entry`);
      }

      toast.success(`Journal entry ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
      handleCloseModal();
      fetchJournalEntries();
      router.refresh();

    } catch (error: any) {
      setFormError(error.message || 'An unexpected error occurred.');
      toast.error(error.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
      if(window.confirm("Are you sure you want to delete this journal entry?")) {
          try {
              const res = await fetch(`/api/journal/${entryId}`, {method: 'DELETE'});
              if(!res.ok) {
                  const err = await res.json();
                  throw new Error(err.error || "Failed to delete entry");
              }
              toast.success("Entry deleted!");
              fetchJournalEntries(); // Refresh
          } catch(e: any) {
              toast.error(e.message || "Could not delete entry.");
          }
      }
  };


  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading journal entries...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Journal</h1>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          aria-label="Create New Journal Entry"
        >
          + New Entry
        </button>
      </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}role="alert">
          {pageMessage.text}
        </div>
      )}

      {/* TODO: Add Filter/Search Bar and Sort Toggle here */}

      {entries.length === 0 && !isLoading ? (
        <div className="p-10 text-center bg-white rounded-lg shadow-md dark:bg-gray-800">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No Journal Entries Yet</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Start writing to fill this space with your thoughts and reflections!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Grouping by month to be implemented later */}
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteEntry}
            />
          ))}
        </div>
      )}

      {/*
      <JournalEntryFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitEntry} // This will be created next
        initialData={currentEntryForModal}
        mode={modalMode}
        isLoading={isSubmitting}
        error={formError}
      />
      <JournalEntryFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitEntry}
        initialData={currentEntryForModal}
        mode={modalMode}
        isLoading={isSubmitting}
        error={formError}
      />

      {session?.user?.id && (
        <div className="mt-12 space-y-8"> {/* Add some spacing & container for ratings section */}
          <DailyRatingForm
            userId={session.user.id}
            // To refresh RecentRatingsDisplay when a new rating is saved by DailyRatingForm:
            // One way is to lift a 'refreshTrigger' state up or use a pub/sub or context.
            // For simplicity now, RecentRatingsDisplay fetches on its own mount.
            // A full page router.refresh() in DailyRatingForm's onSubmit would also work
            // if DailyRatingForm was part of this component, or pass a callback to trigger fetch.
            onRatingSaved={() => {
                // Potentially trigger a re-fetch in RecentRatingsDisplay if it were a sibling managed here
                // Or if RecentRatingsDisplay has its own internal refresh mechanism based on a prop
                // For now, this callback isn't directly making RecentRatingsDisplay refetch without more setup.
                // A simple router.refresh() after saving in DailyRatingForm would make the whole page re-evaluate.
            }}
          />
          <RecentRatingsDisplay userId={session.user.id} />
        </div>
      )}
    </div>
  );
}
