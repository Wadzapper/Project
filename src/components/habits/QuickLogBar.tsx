'use client';

import React from 'react';
import { HabitDisplay } from '@/app/habits/page'; // Assuming this is the correct path and interface
import { HabitType, HabitGoalType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Zap } from 'lucide-react';

interface QuickLogBarProps {
  habits: HabitDisplay[];
  onLogHabit: (habitId: string, success: boolean) => void;
  isLoading?: boolean; // To disable buttons while any log is processing
}

const QuickLogBar: React.FC<QuickLogBarProps> = ({ habits, onLogHabit, isLoading }) => {
  // Filter for daily habits not yet logged today
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const dueHabits = habits.filter(habit => {
    // Basic filter: DAILY habits, not archived, and not loggedToday
    // loggedToday should be accurately provided by the API after the backend changes
    return habit.goalType === HabitGoalType.DAILY && !habit.archived && !habit.loggedToday;
  });

  if (dueHabits.length === 0) {
    return (
      <div className="p-4 bg-card border rounded-lg text-center">
        <p className="text-sm text-muted-foreground">🎉 No daily habits due for logging today, or they're already logged!</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg">
      <h3 className="text-md font-semibold mb-3 text-foreground">Log Today's Daily Habits:</h3>
      <div className="space-y-3">
        {dueHabits.map(habit => (
          <div key={habit.id} className="flex items-center justify-between p-3 bg-background rounded-md border hover:bg-muted/50 transition-colors">
            <div className="flex items-center">
              <Zap className={`h-5 w-5 mr-2 ${habit.type === HabitType.GOOD ? 'text-yellow-500' : 'text-red-500'}`} />
              <span className="text-sm font-medium text-foreground">{habit.name}</span>
            </div>
            <div className="flex space-x-2">
              {habit.type === HabitType.GOOD && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white dark:border-green-600 dark:text-green-500 dark:hover:bg-green-600 dark:hover:text-white"
                  onClick={() => onLogHabit(habit.id, true)}
                  disabled={isLoading || habit.loggedToday}
                  aria-label={`Log success for ${habit.name}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Done
                </Button>
              )}
              {habit.type === HabitType.BAD && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white dark:border-green-600 dark:text-green-500 dark:hover:bg-green-600 dark:hover:text-white"
                    onClick={() => onLogHabit(habit.id, true)} // True = successfully avoided
                    disabled={isLoading || habit.loggedToday}
                    aria-label={`Log successful avoidance for ${habit.name}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Avoided
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-600 dark:text-red-500 dark:hover:bg-red-600 dark:hover:text-white"
                    onClick={() => onLogHabit(habit.id, false)} // False = failed to avoid
                    disabled={isLoading || habit.loggedToday}
                    aria-label={`Log failure for ${habit.name}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Failed
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickLogBar;
