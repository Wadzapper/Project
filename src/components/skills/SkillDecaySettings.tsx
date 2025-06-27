'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { SkillWithDecayFields } from '@/lib/skillUtils'; // Assuming this type is exported
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox'; // Alternative for Switch if preferred
import toast from 'react-hot-toast';

interface SkillDecaySettingsProps {
  skill: SkillWithDecayFields;
  onSettingsChange?: (updatedSkill: SkillWithDecayFields) => void;
  // If this component is self-contained for updates, it might not need onSettingsChange immediately,
  // but good for parent components to be aware.
}

const SkillDecaySettings: React.FC<SkillDecaySettingsProps> = ({ skill, onSettingsChange }) => {
  const [decayEnabled, setDecayEnabled] = useState<boolean>(!!skill.decayEnabled);
  const [decayRate, setDecayRate] = useState<number | string>(skill.decayRate || ''); // Use string for input, parse to number
  const [decayIntervalDays, setDecayIntervalDays] = useState<number | string>(skill.decayIntervalDays || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDecayEnabled(!!skill.decayEnabled);
    setDecayRate(skill.decayRate || '');
    setDecayIntervalDays(skill.decayIntervalDays || '');
  }, [skill]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const rate = decayRate === '' ? null : parseFloat(String(decayRate));
    const interval = decayIntervalDays === '' ? null : parseInt(String(decayIntervalDays), 10);

    if (decayEnabled) {
      if (rate === null || rate <= 0) {
        toast.error('Decay Rate must be a positive number if decay is enabled.');
        setIsLoading(false);
        return;
      }
      if (interval === null || interval <= 0) {
        toast.error('Decay Interval must be a positive number of days if decay is enabled.');
        setIsLoading(false);
        return;
      }
    }

    const payload = {
      decayEnabled,
      decayRate: decayEnabled ? rate : null, // Store null if not enabled
      decayIntervalDays: decayEnabled ? interval : null, // Store null if not enabled
    };

    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update decay settings.');
      }

      const updatedSkillData = await response.json();
      // The response from PATCH /api/skills/[skillId] is { updatedSkill, unlockedAchievements }
      // So we need to access updatedSkillData.updatedSkill
      const returnedSkill = updatedSkillData.updatedSkill as SkillWithDecayFields;


      toast.success('Decay settings updated successfully!');
      if (onSettingsChange) {
        onSettingsChange(returnedSkill);
      }
      // Update local state to reflect saved values, especially if rate/interval were nulled
      setDecayEnabled(returnedSkill.decayEnabled || false);
      setDecayRate(returnedSkill.decayRate || '');
      setDecayIntervalDays(returnedSkill.decayIntervalDays || '');

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card text-card-foreground">
      <h3 className="text-lg font-semibold">Skill Decay Settings</h3>
      <div className="flex items-center space-x-2">
        <Switch
          id={`decayEnabled-${skill.id}`}
          checked={decayEnabled}
          onCheckedChange={setDecayEnabled}
          disabled={isLoading}
        />
        <Label htmlFor={`decayEnabled-${skill.id}`}>Enable Skill Decay</Label>
      </div>

      {decayEnabled && (
        <>
          <div className="space-y-1">
            <Label htmlFor={`decayRate-${skill.id}`}>Decay Rate (XP per interval)</Label>
            <Input
              id={`decayRate-${skill.id}`}
              type="number"
              value={decayRate}
              onChange={(e) => setDecayRate(e.target.value)}
              placeholder="e.g., 10"
              min="0.1"
              step="0.1"
              disabled={isLoading || !decayEnabled}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`decayInterval-${skill.id}`}>Decay Interval (days)</Label>
            <Input
              id={`decayInterval-${skill.id}`}
              type="number"
              value={decayIntervalDays}
              onChange={(e) => setDecayIntervalDays(e.target.value)}
              placeholder="e.g., 7"
              min="1"
              step="1"
              disabled={isLoading || !decayEnabled}
            />
          </div>
        </>
      )}
      <div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Decay Settings'}
        </Button>
      </div>
    </form>
  );
};

export default SkillDecaySettings;
