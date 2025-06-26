'use client';

import { WorkoutSessionDisplay } from '@/app/workouts/page'; // Assuming type is exported
import { WorkoutType } from '@prisma/client';
import toast from 'react-hot-toast'; // For placeholder edit action

interface WorkoutSessionCardProps {
  session: WorkoutSessionDisplay;
  onEdit: (session: WorkoutSessionDisplay) => void;
  onDelete: (sessionId: string) => void;
}

const workoutTypeColors: Record<WorkoutType, string> = {
  [WorkoutType.STRENGTH]: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-300 dark:border-red-700',
  [WorkoutType.CARDIO]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  [WorkoutType.MIXED]: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700',
};

export default function WorkoutSessionCard({ session, onEdit, onDelete }: WorkoutSessionCardProps) {
  const typeColorClasses = workoutTypeColors[session.type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';

  return (
    <div className="p-5 bg-white rounded-lg shadow-md dark:bg-gray-800 hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
        <div className="flex-grow mb-2 sm:mb-0">
          <h2
            className="text-xl font-semibold text-gray-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            onClick={() => onEdit(session)} // Clicking title opens edit
            title={`Edit session from ${new Date(session.date).toLocaleDateString()}`}
          >
            Workout - {new Date(session.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColorClasses}`}>
            {session.type.charAt(0) + session.type.slice(1).toLowerCase()}
          </span>
        </div>
        <div className="flex space-x-2 flex-shrink-0 self-start sm:self-center">
          <button
            onClick={() => onEdit(session)}
            className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Edit workout from ${new Date(session.date).toLocaleDateString()}`}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(session.id)}
            className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={`Delete workout from ${new Date(session.date).toLocaleDateString()}`}
          >
            Delete
          </button>
        </div>
      </div>

      {session.notes && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Notes:</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none dark:prose-invert line-clamp-3">
            {session.notes}
          </p>
        </div>
      )}

      {session.exerciseLogs && session.exerciseLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Exercises ({session.exerciseLogs.length}):</h4>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
            {session.exerciseLogs.map((ex, index) => (
              <li key={ex.id || `ex-${index}`} className="truncate">
                <span className="font-medium">{ex.name}</span>
                {ex.sets && ex.sets.length > 0 && ` - ${ex.sets.length} set(s)`}
                {ex.durationMinutes && ` - ${ex.durationMinutes} min`}
                {ex.distanceKm && ` - ${ex.distanceKm} km`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Logged: {new Date(session.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
