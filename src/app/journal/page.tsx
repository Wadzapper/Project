'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import JournalEntryCard from '@/components/journal/JournalEntryCard';
import JournalEntryFormModal, { JournalEntryFormData } from '@/components/journal/JournalEntryFormModal';
import DailyRatingForm from '@/components/ratings/DailyRatingForm';
import RecentRatingsDisplay from '@/components/ratings/RecentRatingsDisplay';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';

export interface JournalEntryDisplay {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
  createdAt: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentEntryForModal, setCurrentEntryForModal] = useState<JournalEntryFormData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const fetchJournalEntries = useCallback(async () => {
    setIsLoading(true);
    setPageMessage(null);
    try {
      const response = await fetch('/api/journal');
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
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchJournalEntries();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [sessionStatus, fetchJournalEntries]);

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
        date: new Date(entry.date).toISOString().split('T')[0],
        tags: entry.tags || [],
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
              fetchJournalEntries();
          } catch(e: any) {
              toast.error(e.message || "Could not delete entry.");
          }
      }
  };

  if (sessionStatus === 'loading' || (isLoading && sessionStatus === 'authenticated')) {
    return <div className="container mx-auto px-4 py-8 text-center text-text-secondary flex items-center justify-center h-screen"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading journal...</div>;
  }

  if (sessionStatus === 'unauthenticated') {
    return <div className="container mx-auto px-4 py-8 text-center text-text-secondary">Please log in to view your journal.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-2">
        <h1 className="text-3xl font-bold text-text-primary">My Journal</h1>
        {sessionStatus === 'authenticated' && (
            <Button
              onClick={handleOpenCreateModal}
              aria-label="Create New Journal Entry"
            >
              <PlusCircle className="mr-2 h-4 w-4"/> New Entry
            </Button>
        )}
      </div>

      {pageMessage && (
        <div
            className={`p-4 mb-4 text-sm rounded-lg ${
                pageMessage.type === 'error'
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
            }`}
            role="alert"
        >
          {pageMessage.text}
        </div>
      )}

      {!isLoading && entries.length === 0 && sessionStatus === 'authenticated' && (
        <div className="p-10 text-center bg-bg-card rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-text-primary">No Journal Entries Yet</h3>
          <p className="mt-2 text-text-secondary">Start writing to fill this space with your thoughts and reflections!</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-6 mt-6">
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

      {isModalOpen && (
        <JournalEntryFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSubmitEntry}
          initialData={currentEntryForModal}
          mode={modalMode}
          isLoading={isSubmitting}
          error={formError}
        />
      )}

      {session?.user?.id && (
        <div className="mt-12 space-y-8">
          <div className="mb-6"> {/* Replaced SectionHeader */}
            <h2 className="text-2xl font-semibold text-text-primary">Daily Ratings</h2>
            <p className="mt-1 text-sm text-text-secondary">Rate your day across key metrics.</p>
          </div>
          <DailyRatingForm
            userId={session.user.id}
            onRatingSaved={() => {
                toast.success("Rating saved! Recent ratings might take a moment to update.");
            }}
          />
          <RecentRatingsDisplay userId={session.user.id} />
        </div>
      )}
    </div>
  );
}
