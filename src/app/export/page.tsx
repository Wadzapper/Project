// src/app/export/page.tsx
import React from 'react';
import ExportForm from '@/components/export/ExportForm'; // Assuming alias setup for @/

export default function ExportPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Data Export</h1>
        <p>Choose your data type and format to download your information.</p>
      </header>
      <main>
        <ExportForm />
      </main>
      <footer style={{ textAlign: 'center', marginTop: '3rem', fontSize: '0.9em', color: '#666' }}>
        <p>Note: For CSV export of "All" data, only a primary data type might be exported due to format limitations. For complete data, use JSON or export specific types.</p>
      </footer>
    </div>
  );
}
