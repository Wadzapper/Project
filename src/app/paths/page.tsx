// src/app/paths/page.tsx
import React from 'react';
import PathList from '@/components/paths/PathList'; // Assuming alias setup for @/

export default function PathsPage() {
  // In a real application, userId would come from session/authentication
  const placeholderUserId = "demo-user";

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-100">
          Your Paths
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2">
          Chart your course to mastery. Each path is a journey made of steps towards your goals.
        </p>
      </header>
      <main>
        <PathList userId={placeholderUserId} />
      </main>
    </div>
  );
}
