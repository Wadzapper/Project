'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SkillDecaySettings from '@/components/skills/SkillDecaySettings';
import { SkillWithDecayFields } from '@/lib/skillUtils'; // Ensure this type is correctly exported and path is right
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SkillDecayManagementPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.skillId as string;

  const [skill, setSkill] = useState<SkillWithDecayFields | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkillData = async () => {
    if (!skillId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/skills/${skillId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch skill data.');
      }
      const data: SkillWithDecayFields = await response.json();
      setSkill(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkillData();
  }, [skillId]);

  const handleSettingsUpdated = (updatedSkill: SkillWithDecayFields) => {
    // Option 1: Update local state directly
    setSkill(updatedSkill);
    // Option 2: Refetch (good if other derived data might change or to ensure consistency)
    // fetchSkillData();
  };

  if (isLoading) {
    return <div className="container mx-auto p-4 text-center">Loading skill decay settings...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!skill) {
    return <div className="container mx-auto p-4 text-center">Skill not found.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Decay Settings for: <span className="text-primary">{skill.name}</span></h1>
        <p className="text-sm text-muted-foreground">
          Current XP: {skill.currentXp}, Level: {skill.currentLevel}
        </p>
      </div>

      <SkillDecaySettings skill={skill} onSettingsChange={handleSettingsUpdated} />

      {/* Future: Could add a section here to manually trigger a decay check for testing */}
      {/* Or display more detailed explanation of how decay works */}
    </div>
  );
}
