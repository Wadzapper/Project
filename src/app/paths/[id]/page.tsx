// src/app/paths/[id]/page.tsx
import React from 'react';
import PathDetailViewer from '@/components/paths/PathDetailViewer'; // Assuming alias

interface PathDetailPageProps {
  params: {
    id: string; // This is the pathId from the route
  };
}

// This page will be a Server Component by default in Next.js App Router
// It can fetch initial data here or let the client component fetch.
// For simplicity and to allow PathDetailViewer to handle its own data fetching and state,
// we'll pass the ID and let PathDetailViewer fetch.
// Alternatively, for SSR/SSG, data fetching could happen here.

export default function PathDetailPage({ params }: PathDetailPageProps) {
  const { id: pathId } = params;

  return (
    <div className="container mx-auto px-2 py-4 md:px-4 md:py-8">
      {/*
        PathDetailViewer will fetch its own data using the pathId.
        We could pass initial data here if fetched server-side to avoid client-side loading state.
        For example:
        const pathData = await getPathData(pathId); // Server-side fetch
        <PathDetailViewer pathId={pathId} initialPathData={pathData} />
      */}
      <PathDetailViewer pathId={pathId} />
    </div>
  );
}

// Example of a server-side data fetching function if we wanted to pass initial data
// async function getPathData(pathId: string) {
//   try {
//     // This URL needs to be absolute if fetched server-side during build or SSR from itself
//     // Or use a direct Prisma call if this function is in a server-only context
//     const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/paths/${pathId}`);
//     if (!response.ok) {
//       // Handle error appropriately, maybe return null or throw
//       console.error("Failed to fetch path data for SSR/SSG");
//       return null;
//     }
//     return response.json();
//   } catch (error) {
//     console.error("Error in getPathData:", error);
//     return null;
//   }
// }
