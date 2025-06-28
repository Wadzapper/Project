'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { QuestType as PrismaQuestType } from '@prisma/client';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface TimelineDataPoint {
  period: string;
  count: number;
}

interface StatusDistributionPoint {
  name: string;
  value: number;
}

const PIE_CHART_COLORS_THEMED = [
  'var(--color-success)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-accent-danger)',
  'var(--color-accent-primary)',
  'var(--color-text-secondary)'
];

export default function QuestsAnalyticsPage() {
  const router = useRouter();
  const [completionTimeline, setCompletionTimeline] = useState<TimelineDataPoint[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistributionPoint[]>([]);
  const [timelinePeriod, setTimelinePeriod] = useState('30d');
  const [timelineGroupBy, setTimelineGroupBy] = useState('day');
  const [selectedQuestType, setSelectedQuestType] = useState<string>('');

  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tooltipStyle = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-primary)',
    color: 'var(--color-text-primary)',
    borderRadius: 'var(--radius)'
  };
  const tickFill = 'var(--color-text-secondary)';
  const gridStroke = 'var(--color-border-secondary)';
  const legendStyle = { color: 'var(--color-text-secondary)', fontSize: '12px' };

  useEffect(() => {
    const fetchTimelineData = async () => {
      setIsLoadingTimeline(true);
      setError(null);
      try {
        let apiUrl = `/api/analytics/quests/completion-timeline?period=${timelinePeriod}&groupBy=${timelineGroupBy}`;
        if (selectedQuestType) {
          apiUrl += `&questType=${selectedQuestType}`;
        }
        const res = await fetch(apiUrl);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error ||'Failed to fetch quest completion timeline');
        }
        const data = await res.json();
        setCompletionTimeline(data);
      } catch (err: any) {
        setError(err.message);
        setCompletionTimeline([]);
        toast.error(`Timeline Error: ${err.message}`);
      } finally {
        setIsLoadingTimeline(false);
      }
    };
    fetchTimelineData();
  }, [timelinePeriod, timelineGroupBy, selectedQuestType]);

  useEffect(() => {
    const fetchStatusData = async () => {
      setIsLoadingStatus(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/quests/summary`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch quest status distribution');
        }
        const data = await res.json();
        if (data.statusCounts) {
            setStatusDistribution(
                Object.entries(data.statusCounts).map(([name, value]) => ({ name: name.replace('_',' '), value: value as number}))
            );
        } else {
            setStatusDistribution([]);
        }
      } catch (err: any) {
        setError(err.message);
        setStatusDistribution([]);
        toast.error(`Status Dist. Error: ${err.message}`);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatusData();
  }, []);

  const renderLoader = (text: string) => (
    <div className="flex justify-center items-center h-[300px] text-text-secondary">
      <Loader2 className="mr-2 h-5 w-5 animate-spin"/>{text}
    </div>
  );

  const renderError = (message: string) => (
    <div className="text-center py-10 text-red-500 dark:text-red-400">{message}</div>
  );

  const renderNoData = (message: string) => (
     <div className="text-center py-10 text-text-secondary">{message}</div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
        <h1 className="text-3xl font-bold text-text-primary">Quests Analytics</h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4 text-text-secondary" /> Back
        </Button>
      </div>

      {error && <p className="text-red-500 dark:text-red-400 mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-md">Error: {error}</p>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-text-primary">Quest Completion Timeline</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <div>
                <Label htmlFor="timelinePeriod" className="mr-1 text-text-secondary">Period:</Label>
                <Select value={timelinePeriod} onValueChange={setTimelinePeriod}>
                    <SelectTrigger id="timelinePeriod" className="p-1 h-7 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                        <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                        <SelectItem value="90d" className="text-xs">Last 90 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="timelineGroupBy" className="mr-1 text-text-secondary">Group by:</Label>
                <Select value={timelineGroupBy} onValueChange={setTimelineGroupBy}>
                    <SelectTrigger id="timelineGroupBy" className="p-1 h-7 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day" className="text-xs">Day</SelectItem>
                        <SelectItem value="week" className="text-xs">Week</SelectItem>
                        <SelectItem value="month" className="text-xs">Month</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="timelineQuestType" className="mr-1 text-text-secondary">Quest Type:</Label>
                <Select value={selectedQuestType} onValueChange={setSelectedQuestType}>
                    <SelectTrigger id="timelineQuestType" className="p-1 h-7 text-xs"><SelectValue placeholder="All Types"/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="" className="text-xs">All Types</SelectItem>
                        {Object.values(PrismaQuestType).map(type => (
                            <SelectItem key={type} value={type} className="text-xs">{type.replace('_',' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        </CardHeader>
        <CardContent className="h-[350px]">
        {isLoadingTimeline ? renderLoader("Loading timeline...") : completionTimeline.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={completionTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.3} />
              <XAxis dataKey="period" fontSize={12} stroke={gridStroke} tick={{ fill: tickFill }} />
              <YAxis allowDecimals={false} fontSize={12} stroke={gridStroke} tick={{ fill: tickFill }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--color-accent-primary)', fillOpacity: 0.1}}/>
              <Legend wrapperStyle={legendStyle}/>
              <Bar dataKey="count" name="Quests Completed" fill="var(--color-success)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : renderNoData("No quest completion data for this period/grouping.")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-text-primary">Quest Status Distribution</CardTitle>
            <CardDescription className="text-text-secondary">Current breakdown of quests by status.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
        {isLoadingStatus ? renderLoader("Loading status distribution...") : statusDistribution.some(s => s.value > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusDistribution.filter(s => s.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="var(--color-accent-primary)"
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                fontSize={12}
              >
                {statusDistribution.filter(s => s.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS_THEMED[index % PIE_CHART_COLORS_THEMED.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : renderNoData("No quest status data available.")}
        </CardContent>
      </Card>
    </div>
  );
}
