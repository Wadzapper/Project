// src/components/skills/SkillDecaySettings.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Skill as PrismaSkill } from '@prisma/client'; // Assuming Prisma types are available

// Define the expected shape of the skill prop, including potential effective values
export interface SkillWithEffectiveValues extends PrismaSkill {
  effectiveXp?: number;
  effectiveLevel?: number;
}

interface SkillDecaySettingsProps {
  skill: SkillWithEffectiveValues;
  onSettingsUpdated?: (updatedSkill: SkillWithEffectiveValues) => void; // Optional callback
}

const SkillDecaySettings: React.FC<SkillDecaySettingsProps> = ({ skill, onSettingsUpdated }) => {
  const [decayEnabled, setDecayEnabled] = useState<boolean>(skill.decayEnabled || false);
  const [decayRate, setDecayRate] = useState<string>((skill.decayRate || 0).toString()); // Store as string for input
  const [decayIntervalDays, setDecayIntervalDays] = useState<string>((skill.decayIntervalDays || 0).toString()); // Store as string

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDecayEnabled(skill.decayEnabled || false);
    setDecayRate((skill.decayRate || 0).toString());
    setDecayIntervalDays((skill.decayIntervalDays || 0).toString());
  }, [skill]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const rate = parseFloat(decayRate);
    const interval = parseInt(decayIntervalDays, 10);

    if (decayEnabled) {
      if (isNaN(rate) || rate <= 0 || rate > 1) {
        setError('Decay rate must be a number between 0 (exclusive) and 1 (inclusive) when enabled.');
        setIsLoading(false);
        return;
      }
      if (isNaN(interval) || interval <= 0) {
        setError('Decay interval must be a positive number of days when enabled.');
        setIsLoading(false);
        return;
      }
    }

    const payload = {
      decayEnabled,
      decayRate: decayEnabled ? rate : null, // Send null if not enabled, Prisma schema allows null
      decayIntervalDays: decayEnabled ? interval : null, // Send null if not enabled
    };

    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const updatedSkillData: SkillWithEffectiveValues = await response.json();

      if (!response.ok) {
        throw new Error(updatedSkillData.message || `Failed to update settings: ${response.status}`);
      }

      setSuccessMessage('Skill decay settings updated successfully!');
      if (onSettingsUpdated) {
        onSettingsUpdated(updatedSkillData); // Pass the full updated skill data back
      }
      // Update local state to reflect server response, though useEffect on `skill` prop might also handle this if parent re-fetches
      setDecayEnabled(updatedSkillData.decayEnabled || false);
      setDecayRate((updatedSkillData.decayRate || 0).toString());
      setDecayIntervalDays((updatedSkillData.decayIntervalDays || 0).toString());

    } catch (err: any) {
      console.error('Error updating skill decay settings:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', maxWidth: '500px' }}>
      <h4>Skill Decay Settings for: {skill.name}</h4>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={decayEnabled}
            onChange={(e) => setDecayEnabled(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          Enable Skill Decay
        </label>
      </div>

      {decayEnabled && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor={`decayRate-${skill.id}`} style={{ display: 'block', marginBottom: '0.25rem' }}>
              Decay Rate (e.g., 0.05 for 5%):
            </label>
            <input
              type="number"
              id={`decayRate-${skill.id}`}
              value={decayRate}
              onChange={(e) => setDecayRate(e.target.value)}
              step="0.01"
              min="0.001"
              max="1"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              disabled={!decayEnabled}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor={`decayInterval-${skill.id}`} style={{ display: 'block', marginBottom: '0.25rem' }}>
              Decay Interval (days):
            </label>
            <input
              type="number"
              id={`decayInterval-${skill.id}`}
              value={decayIntervalDays}
              onChange={(e) => setDecayIntervalDays(e.target.value)}
              step="1"
              min="1"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              disabled={!decayEnabled}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isLoading}
        style={{ padding: '0.5rem 1rem', backgroundColor: isLoading? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        {isLoading ? 'Saving...' : 'Save Decay Settings'}
      </button>

      {successMessage && <p style={{ color: 'green', marginTop: '0.5rem' }}>{successMessage}</p>}
      {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>Error: {error}</p>}

      <div style={{marginTop: '1rem', fontSize: '0.9em', color: '#555'}}>
        <p>Current Stored XP: {skill.xp}, Level: {skill.level}</p>
        {skill.effectiveXp !== undefined && <p>Effective XP (after decay): {skill.effectiveXp}, Level: {skill.effectiveLevel}</p>}
        {skill.lastDecay && <p>Last Decay Applied/Reset: {new Date(skill.lastDecay).toLocaleDateString()}</p>}
      </div>
    </form>
  );
};

export default SkillDecaySettings;
