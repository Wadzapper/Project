'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Example data structures, will be refined based on API responses
interface WeightDataPoint {
  date: string; // Formatted for display
  weightKg: number | null;
}
interface WorkoutCountDataPoint {
  period: string; // e.g., "Week 1", "Jan"
  count: number;
}
// ... other data types as needed

export default function FitnessAnalyticsPage() {
  const [weightTrend, setWeightTrend] = useState<WeightDataPoint[]>([]);
  const [workoutCounts, setWorkoutCounts] = useState<WorkoutCountDataPoint[]>([]);
  // Add states for other charts: total volume/reps, sleep quality vs mood

  const [isLoadingWeight, setIsLoadingWeight] = useState(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true); // Renamed for clarity
  const [error, setError] = useState<string | null>(null);

  const [weightPeriod, setWeightPeriod] = useState('90d');
  const [workoutCountPeriod, setWorkoutCountPeriod] = useState('90d');
  const [workoutCountGroupBy, setWorkoutCountGroupBy] = useState('week');
  const [exerciseForSummary, setExerciseForSummary] = useState(''); // For selecting exercise for volume/reps
  const [userExercises, setUserExercises] = useState<string[]>([]); // List of unique exercise names logged by user
  const [exerciseSummaryData, setExerciseSummaryData] = useState<any[]>([]);
  const [isLoadingExerciseSummary, setIsLoadingExerciseSummary] = useState(false);
  const [sleepMoodData, setSleepMoodData] = useState<any[]>([]);
  const [isLoadingSleepMood, setIsLoadingSleepMood] = useState(false);
  const [sleepMoodPeriod, setSleepMoodPeriod] = useState('30d');


  // Fetch Weight Trend Data
  useEffect(() => {
    const fetchWeightData = async () => {
      setIsLoadingWeight(true);
      try {
        const res = await fetch(`/api/analytics/fitness/weight-trend?period=${weightPeriod}`);
        if (!res.ok) throw new Error('Failed to fetch weight trend');
        const data = await res.json();
        setWeightTrend(data.map((d:any) => ({...d, date: new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}) })));
      } catch (err: any) { setError(err.message); setWeightTrend([]); }
      finally { setIsLoadingWeight(false); }
    };
    fetchWeightData();
  }, [weightPeriod]);

  // Fetch Workout Count Data
  useEffect(() => {
    const fetchWorkoutCountData = async () => {
      setIsLoadingWorkouts(true); // Use renamed state setter
      try {
        const res = await fetch(`/api/analytics/fitness/workout-counts?period=${workoutCountPeriod}&groupBy=${workoutCountGroupBy}`);
        if (!res.ok) throw new Error('Failed to fetch workout counts');
        const data = await res.json();
        setWorkoutCounts(data);
      } catch (err: any) { setError(err.message); setWorkoutCounts([]); }
      finally { setIsLoadingWorkouts(false); } // Use renamed state setter
    };
    fetchWorkoutCountData();
  }, [workoutCountPeriod, workoutCountGroupBy]);

  // Fetch unique exercise names for dropdown
  useEffect(() => {
    const fetchUniqueExerciseNames = async () => {
        try {
            // This would ideally be a dedicated API endpoint: GET /api/exercises/names
            // For now, simulating or could derive from a general GET /api/workouts if it returns all data
            // Placeholder until such API exists:
            // const res = await fetch('/api/user-exercise-names');
            // if(!res.ok) throw new Error("Failed to fetch exercise names");
            // setUserExercises(await res.json());
            console.warn("API for unique exercise names not implemented. Using placeholder.");
            setUserExercises(["Bench Press", "Squat", "Running"]);
            if (userExercises.length > 0 && !exerciseForSummary) setExerciseForSummary(userExercises[0]);
        } catch (err: any) {
            console.error("Error fetching exercise names:", err.message);
            setUserExercises([]);
        }
    };
    fetchUniqueExerciseNames();
  }, []); // Run once

  // Fetch Exercise Summary Data
  useEffect(() => {
    if (!exerciseForSummary) return;
    const fetchExerciseSummary = async () => {
        setIsLoadingExerciseSummary(true);
        try {
            const res = await fetch(`/api/analytics/fitness/exercise-summary?period=${workoutCountPeriod}&exerciseName=${encodeURIComponent(exerciseForSummary)}`);
            if(!res.ok) throw new Error("Failed to fetch exercise summary");
            setExerciseSummaryData(await res.json());
        } catch (err:any) { setError(err.message); setExerciseSummaryData([]); }
        finally { setIsLoadingExerciseSummary(false); }
    };
    fetchExerciseSummary();
  }, [exerciseForSummary, workoutCountPeriod]);

  // Fetch Sleep-Mood Correlation Data
  useEffect(() => {
    const fetchSleepMood = async () => {
        setIsLoadingSleepMood(true);
        try {
            const res = await fetch(`/api/analytics/fitness/sleep-mood-correlation?period=${sleepMoodPeriod}`);
            if(!res.ok) throw new Error("Failed to fetch sleep-mood data");
            const data = await res.json();
            setSleepMoodData(data.map((d:any) => ({...d, date: new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}) })));
        } catch(err:any) { setError(err.message); setSleepMoodData([]); }
        finally { setIsLoadingSleepMood(false); }
    };
    fetchSleepMood();
  }, [sleepMoodPeriod]);


  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Fitness & Health Analytics
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}

      {/* Weight Over Time Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Weight Over Time</h2>
             <div className="text-xs">
                <label htmlFor="weightPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="weightPeriod" value={weightPeriod} onChange={e => setWeightPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="1y">Last Year</option>
                    <option value="all">All Time</option>
                </select>
            </div>
        </div>
        {isLoadingWeight ? <p className="text-center py-10 dark:text-gray-300">Loading weight data...</p> : weightTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weightTrend}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="weightKg" name="Weight (kg)" stroke="#82ca9d" activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No weight data logged for this period.</p>}
      </div>

      {/* Weekly Workout Count Chart */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Workout Frequency</h2>
            <div className="flex flex-wrap gap-2 text-xs">
                <div>
                    <label htmlFor="workoutCountPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                    <select id="workoutCountPeriod" value={workoutCountPeriod} onChange={e => setWorkoutCountPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                         <option value="1y">Last Year</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="workoutCountGroupBy" className="mr-1 dark:text-gray-300">Group by:</label>
                    <select id="workoutCountGroupBy" value={workoutCountGroupBy} onChange={e => setWorkoutCountGroupBy(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        {/* <option value="day">Day</option> */}
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                    </select>
                </div>
            </div>
        </div>
        {isLoadingWorkouts ? <p className="text-center py-10 dark:text-gray-300">Loading workout counts...</p> : workoutCounts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workoutCounts}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="period" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12}/>
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Workouts" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No workout data for this period.</p>}
      </div>

      {/* Exercise Summary (Volume/Reps) */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Exercise Summary</h2>
            <div className="text-xs">
                <label htmlFor="exerciseSummarySelect" className="mr-1 dark:text-gray-300">Exercise:</label>
                <select id="exerciseSummarySelect" value={exerciseForSummary} onChange={e => setExerciseForSummary(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="">All Exercises</option>
                    {userExercises.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
        </div>
        {isLoadingExerciseSummary ? <p className="text-center py-10 dark:text-gray-300">Loading exercise summary...</p> : exerciseSummaryData.length > 0 ? (
             <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-2">Exercise</th>
                    <th scope="col" className="px-4 py-2 text-right">Total Sets</th>
                    <th scope="col" className="px-4 py-2 text-right">Total Reps</th>
                    <th scope="col" className="px-4 py-2 text-right">Total Volume (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {exerciseSummaryData.map(ex => (
                    <tr key={ex.exerciseName} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{ex.exerciseName}</td>
                      <td className="px-4 py-2 text-right">{ex.totalSets}</td>
                      <td className="px-4 py-2 text-right">{ex.totalReps}</td>
                      <td className="px-4 py-2 text-right">{ex.totalVolume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No summary data for selected exercise/period.</p>}
      </div>

      {/* Sleep Quality vs Mood */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Sleep Quality vs Mood (Last 30 Days)</h2>
            <div className="text-xs">
                <label htmlFor="sleepMoodPeriod" className="mr-1 dark:text-gray-300">Period:</label>
                <select id="sleepMoodPeriod" value={sleepMoodPeriod} onChange={e => setSleepMoodPeriod(e.target.value)} className="p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
        </div>
         {isLoadingSleepMood ? <p className="text-center py-10 dark:text-gray-300">Loading sleep/mood data...</p> : sleepMoodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sleepMoodData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                    <XAxis dataKey="date" fontSize={12}/>
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" domain={[0, 5]} allowDecimals={false} fontSize={12} label={{ value: 'Rating (1-5)', angle: -90, position: 'insideLeft' }}/>
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 12]} allowDecimals={true} fontSize={12} label={{ value: 'Hours', angle: 90, position: 'insideRight' }}/>
                    <Tooltip/>
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="mood" name="Mood (1-5)" stroke="#8884d8" activeDot={{r: 6}} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="sleepQuality" name="Sleep Quality (1-5)" stroke="#ffc658" activeDot={{r: 6}} connectNulls />
                    {/* <Line yAxisId="right" type="monotone" dataKey="sleepHours" name="Sleep Hours" stroke="#82ca9d" activeDot={{r: 6}} connectNulls /> */}
                </LineChart>
            </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-gray-400 text-center py-10">No sleep or mood data for correlation.</p>}
      </div>
    </div>
  );
}
