// Summary: Page to display analytics for Tags, showing usage across Habits and Quests.
// TODO: Implement actual CSV export functionality for the button.
// TODO: Add sorting and filtering options for the tag list.
// TODO: Consider pagination if the number of tags can be very large.

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Tag, Activity, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface TagAnalyticsEntry {
  id: string;
  name: string;
  color: string | null;
  habitCount: number;
  questCount: number;
}

const TagAnalyticsPage = () => {
  const router = useRouter();
  const [tagAnalytics, setTagAnalytics] = useState<TagAnalyticsEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTagAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/analytics/tags');
        if (!response.ok) {
          const errData = await response.json();
          // Check for specific 501 error from API if Tag system isn't set up
          if (response.status === 501 && errData.error?.includes("Tag feature might not be fully set up")) {
            throw new Error("Tag system not fully configured in the backend. " + (errData.details || ''));
          }
          throw new Error(errData.error || 'Failed to fetch tag analytics.');
        }
        const data: TagAnalyticsEntry[] = await response.json();
        setTagAnalytics(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTagAnalytics();
  }, []);

  const handleExportCSV = () => {
    // For MVP, this is a stub. Actual CSV generation would happen here or via API call.
    // window.location.href = '/api/export?type=taganalytics&format=csv'; // If API supports this
    toast.success('CSV export for tags - functionality to be implemented!');
  };

  if (isLoading) return <div className="container mx-auto p-6 text-center flex items-center justify-center h-[300px]"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading tag analytics...</div>;
  // Do not show generic error if the specific 501 error for Tag system setup is caught.
  // The toast would have already shown it. Let the empty state handle it.
  if (error && !error.includes("Tag system not fully configured")) return <div className="container mx-auto p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-2 sm:mb-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left flex-grow sm:flex-none">Tag Usage Analytics</h1>
        <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={tagAnalytics.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV (Stub)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tag className="mr-2 h-5 w-5 text-primary"/> Tags Overview
          </CardTitle>
          <CardDescription>Usage counts for each tag across your Habits and Quests.</CardDescription>
        </CardHeader>
        <CardContent>
          {tagAnalytics.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              {error && error.includes("Tag system not fully configured")
                ? "Tag system is not yet fully configured in the backend."
                : "No tags found or no usage data available."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Color</TableHead>
                  <TableHead>Tag Name</TableHead>
                  <TableHead className="text-center">Habit Count</TableHead>
                  <TableHead className="text-center">Quest Count</TableHead>
                  <TableHead className="text-right">Total Uses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagAnalytics.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <span
                        className="inline-block w-4 h-4 rounded-sm border"
                        style={{ backgroundColor: tag.color || '#e2e8f0' }} // Default to a light gray
                        title={tag.color || 'Default Color'}
                      ></span>
                    </TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-center">{tag.habitCount}</TableCell>
                    <TableCell className="text-center">{tag.questCount}</TableCell>
                    <TableCell className="text-right">{tag.habitCount + tag.questCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TagAnalyticsPage;
