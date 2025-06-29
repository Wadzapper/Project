// src/components/export/ExportForm.tsx
'use client';

import React, { useState, FormEvent } from 'react';

const ExportForm = () => {
  const [dataType, setDataType] = useState<'skills' | 'quests' | 'habits' | 'all'>('all');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [userId, setUserId] = useState<string>(''); // In a real app, get this from session/auth
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (!userId) {
      setError('User ID is required. Please enter a User ID.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/export?userId=${encodeURIComponent(userId)}&type=${dataType}&format=${format}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Export failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `${userId}_export_${dataType}.${format}`; // Default filename

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage(`Export successful! File '${fileName}' should be downloading.`);

    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'An unexpected error occurred during export.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: 'auto' }}>
      <h2>Export Data</h2>

      {/* This UserId input is for testing. In a real app, it would come from auth. */}
      <div>
        <label htmlFor="userId" style={{ marginRight: '0.5rem' }}>User ID (for testing):</label>
        <input
          type="text"
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter User ID"
          required
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div>
        <label htmlFor="dataType" style={{ marginRight: '0.5rem' }}>Data Type:</label>
        <select
          id="dataType"
          value={dataType}
          onChange={(e) => setDataType(e.target.value as any)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="all">All</option>
          <option value="skills">Skills</option>
          <option value="quests">Quests</option>
          <option value="habits">Habits</option>
        </select>
      </div>

      <div>
        <label htmlFor="format" style={{ marginRight: '0.5rem' }}>Format:</label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value as any)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{ padding: '0.75rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {isLoading ? 'Exporting...' : 'Download Export'}
      </button>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </form>
  );
};

export default ExportForm;
