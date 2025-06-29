// src/app/export/page.tsx
import React from 'react';
import ExportForm from '@/components/export/ExportForm'; // Assuming alias setup for @/

export default function ExportPage() {
  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-100">
          Export Your Data
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2">
          Download an archive of all your application data in CSV format, bundled into a single ZIP file.
        </p>
      </header>
      <main className="max-w-lg mx-auto">
        <ExportForm />
      </main>
      <footer className="text-center mt-12 text-sm text-zinc-500 dark:text-zinc-400">
        <p>Your data archive will contain separate CSV files for each data category (e.g., skills, quests, habits).</p>
        <p>Please keep this archive in a safe place.</p>
      </footer>
    </div>
  );
}
