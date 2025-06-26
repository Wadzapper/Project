'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skill } from '@/app/skills/page';
import { useSearchParams } from 'next/navigation';

interface XpOverTimeDataPoint {
  date: string;
  xp: number;
}

interface SkillProgressLogEntry {
  id: string;
  createdAt: string;
  xpChange: number;
  source: string | null;
  skill: { name: string };
}

export default function SkillsAnalyticsPage() {
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [xpOverTimeData, setXpOverTimeData] = useState<XpOverTimeDataPoint[]>([]);
  const [skillLogs, setSkillLogs] = useState<SkillProgressLogEntry[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpChartPeriod, setXpChartPeriod] = useState<string>('90d');
  const searchParams = useSearchParams();

  useEffect(() => {
    const initialSkillIdFromQuery = searchParams.get('skillId');
    const fetchSkills = async () => {
      setIsLoadingSkills(true);
      setError(null);
      try {
        const res = await fetch('/api/skills');
        if (!res.ok) throw new Error('Failed to fetch skills');
        const data = await res.json();
        setUserSkills(data);
        if (initialSkillIdFromQuery && data.some((s: Skill) => s.id === initialSkillIdFromQuery)) {
          setSelectedSkillId(initialSkillIdFromQuery);
        } else if (data.length > 0) {
          setSelectedSkillId(data[0].id);
        } else {
          setSelectedSkillId(''); // No skills available
        }
      } catch (err: any) {
        setError(err.message);
        setUserSkills([]);
        setSelectedSkillId('');
      } finally {
        setIsLoadingSkills(false);
      }
    };
    fetchSkills();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedSkillId) {
      setXpOverTimeData([]);
      setSkillLogs([]);
      return;
    }
    const fetchXpData = async () => {
      setIsLoadingChart(true);
      try {
        const res = await fetch(`/api/analytics/skills/xp-over-time?skillId=${selectedSkillId}&period=${xpChartPeriod}`);
        if (!res.ok) throw new Error('Failed to fetch XP data');
        const data = await res.json();
        setXpOverTimeData(data.map((d: any) => ({...d, date: new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})})));
      } catch (err: any) {
        setError(err.message); // Potentially set a more specific error state for this chart
        setXpOverTimeData([]);
      } finally {
        setIsLoadingChart(false);
      }
    };
    fetchXpData();
  }, [selectedSkillId, xpChartPeriod]);

  useEffect(() => {
    if (!selectedSkillId) {
      setSkillLogs([]);
      setLogsTotalPages(1);
      setLogsPage(1);
      return;
    }
    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const res = await fetch(`/api/analytics/skills/logs?skillId=${selectedSkillId}&page=${logsPage}&limit=5`);
        if (!res.ok) throw new Error('Failed to fetch skill logs');
        const data = await res.json();
        setSkillLogs(data.logs);
        setLogsTotalPages(data.totalPages);
      } catch (err: any) {
        setError(err.message); // Potentially set a more specific error state for logs
        setSkillLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [selectedSkillId, logsPage]);

  const selectedSkillName = userSkills.find(s => s.id === selectedSkillId)?.name || 'Skill';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Skills Analytics
      </h1>

      {isLoadingSkills ? <p className="dark:text-gray-300">Loading skills selector...</p> : error && !userSkills.length ? <p className="text-red-500 dark:text-red-400">{error}</p> : userSkills.length === 0 ? <p className="dark:text-gray-300">No skills created yet to analyze.</p> :(
        <div className="mb-6">
          <label htmlFor="skillSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Skill:</label>
          <select
            id="skillSelect"
            value={selectedSkillId}
            onChange={(e) => { setSelectedSkillId(e.target.value); setLogsPage(1);}} // Reset page on skill change
            className="mt-1 block w-full sm:w-1/2 md:w-1/3 lg:w-1/4 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {userSkills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
        </div>
      )}

      {selectedSkillId && (
        <>
          <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
            <div className="flex flex-wrap justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{selectedSkillName} - XP Over Time</h2>
                <div className="text-xs">
                    <label htmlFor="xpPeriodSelect" className="mr-1 dark:text-gray-300">Period:</label>
                    <select
                        id="xpPeriodSelect"
                        value={xpChartPeriod}
                        onChange={e => setXpChartPeriod(e.target.value)}
                        className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="1y">Last Year</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
            </div>
            {isLoadingChart ? <p className="text-center py-10 dark:text-gray-300">Loading chart...</p> : xpOverTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={xpOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="xp" name="Cumulative XP" stroke="#8884d8" activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No XP data available for this period.</p>}
          </div>

          <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{selectedSkillName} - Activity Log</h2>
              <button
                onClick={handleExportLogsToCSV}
                className="px-3 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                disabled={skillLogs.length === 0 || isLoadingLogs}
              >
                Export CSV
              </button>
            </div>
            {isLoadingLogs ? <p className="text-center py-10 dark:text-gray-300">Loading logs...</p> : skillLogs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th scope="col" className="px-4 py-2">Date</th>
                        <th scope="col" className="px-4 py-2">XP Change</th>
                        <th scope="col" className="px-4 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillLogs.map(log => (
                        <tr key={log.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-4 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className={`px-4 py-2 font-medium ${log.xpChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {log.xpChange >= 0 ? `+${log.xpChange}` : log.xpChange}
                          </td>
                          <td className="px-4 py-2">{log.source || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <button
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsPage <= 1 || isLoadingLogs}
                    className="px-3 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 disabled:opacity-50"
                  >Previous</button>
                  <span className="text-xs text-gray-700 dark:text-gray-300">Page {logsPage} of {logsTotalPages}</span>
                  <button
                    onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                    disabled={logsPage >= logsTotalPages || isLoadingLogs}
                    className="px-3 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 disabled:opacity-50"
                  >Next</button>
                </div>
              </>
            ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No activity logs found for this skill.</p>}
          </div>
        </>
      )}
    </div>
  );
}
