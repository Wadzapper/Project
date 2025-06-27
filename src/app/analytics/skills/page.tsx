// Summary: Page for displaying Skill-related analytics, starting with current XP distribution.
// TODO: Implement actual XP trend graph if historical skill XP data becomes available via SkillProgressLog.
// TODO: Add more skill analytics: e.g., levels distribution, time to level up, most progressed skills.

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';
import { ArrowLeft, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Skill } from '@prisma/client'; // Assuming full Skill type from Prisma
import { getSkillColorClass } from '@/lib/skillUtils'; // For coloring bars by level

// We expect the Skill type from /api/skills to include decay fields if they exist
// and the regular fields like currentXp, name, currentLevel.
type SkillForAnalytics = Pick<Skill, 'id' | 'name' | 'currentXp' | 'currentLevel' | 'targetXpForNextLevel'> & {
    // Add decay fields if they are part of the Skill type fetched from /api/skills
    decayEnabled?: boolean;
    decayRate?: number | null;
    decayIntervalDays?: number | null;
};


const SkillAnalyticsPage = () => {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillForAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkillsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/skills'); // Fetches all skills, applies decay on read
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch skills data.');
        }
        const data: SkillForAnalytics[] = await response.json();
        setSkills(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSkillsData();
  }, []);

  // Prepare data for Top N Skills by XP chart
  const topSkillsByXp = skills
    .filter(skill => (skill.currentXp || 0) > 0) // Only include skills with some XP for this chart
    .sort((a, b) => (b.currentXp || 0) - (a.currentXp || 0))
    .slice(0, 10) // Top 10 skills with XP
    .map(skill => ({
      name: skill.name,
      XP: skill.currentXp || 0,
      level: skill.currentLevel || 1,
    }));


  if (isLoading) return <div className="container mx-auto p-6 text-center flex items-center justify-center h-[300px]"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading skill analytics...</div>;
  if (error) return <div className="container mx-auto p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-2 sm:mb-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left flex-grow sm:flex-none">Skill Analytics</h1>
        <div className="w-[100px] sm:w-auto"> {/* Placeholder */} </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="mr-2 h-5 w-5 text-primary"/> Top Skills by Current XP
          </CardTitle>
          <CardDescription>Comparison of current XP for your top skills (max 10 shown).</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] sm:h-[400px] pt-6">
          {skills.length === 0 ? (
             <p className="text-muted-foreground text-center pt-10">No skills found to display analytics.</p>
          ) : topSkillsByXp.length === 0 && skills.length > 0 ? (
             <p className="text-muted-foreground text-center pt-10">All skills currently have 0 XP or less.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSkillsByXp} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis type="number" fontSize={10} />
                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, dy:2}} interval={0} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                  formatter={(value: number, nameKey: string, props) => {
                    if (nameKey === 'XP') return [value, `XP (Lvl ${props.payload.level})`];
                    return [value, nameKey];
                  }}
                />
                {/* <Legend wrapperStyle={{fontSize: "12px"}}/> */}
                <Bar dataKey="XP" name="Current XP" barSize={20} radius={[0, 4, 4, 0]}>
                    {topSkillsByXp.map((entry, index) => {
                        // Attempt to use skill level color, but parse it from Tailwind class
                        const colorClass = getSkillColorClass(entry.level);
                        let fillColor = '#8884d8'; // Default color
                        if (colorClass.includes('blue')) fillColor = '#3b82f6';
                        else if (colorClass.includes('green')) fillColor = '#22c55e';
                        else if (colorClass.includes('yellow')) fillColor = '#eab308';
                        else if (colorClass.includes('orange')) fillColor = '#f97316';
                        else if (colorClass.includes('red')) fillColor = '#ef4444';
                        else if (colorClass.includes('purple')) fillColor = '#a855f7';
                        else if (colorClass.includes('pink')) fillColor = '#ec4899';
                        return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for future Skill Trend Graph (XP over time) */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-green-500"/>Skill XP Progression (Placeholder)</CardTitle>
            <CardDescription>Historical XP growth for selected skills (feature pending historical data from SkillProgressLog).</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
            <TrendingUp className="w-16 h-16 text-muted-foreground opacity-50"/>
        </CardContent>
      </Card>

    </div>
  );
};

export default SkillAnalyticsPage;
