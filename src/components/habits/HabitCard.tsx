import React, { useState } from 'react';
import { HabitType, HabitGoalType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Edit3, Trash2, ChevronDown, ChevronUp, TrendingUp, Zap } from 'lucide-react';

export interface HabitCardProps {
  id: string;
  name: string;
  description?: string | null;
  type: HabitType;
  goalType: HabitGoalType;
  frequency: number; // Not directly used in card display yet, but good to have
  periodInDays?: number | null; // Same as frequency
  tags: string[]; // Not directly used in card display yet
  archived: boolean; // Handled by parent filtering
  createdAt: string; // Potentially for display or sorting
  currentStreak?: number;
  successRate?: number; // Percentage 0-100
  loggedToday?: boolean;
  onLog?: (id: string, success: boolean) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const HabitCard: React.FC<HabitCardProps> = ({
  id,
  name,
  description,
  type,
  goalType,
  currentStreak = 0,
  successRate, // Can be undefined if not calculated yet
  loggedToday = false,
  onLog,
  onEdit,
  onDelete,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleLog = (success: boolean) => {
    if (onLog) {
      onLog(id, success);
    }
  };

  const isGoodHabit = type === HabitType.GOOD;
  const cardBorderColor = isGoodHabit ? 'border-green-500 dark:border-green-700' : 'border-red-500 dark:border-red-700';
  const accentColor = isGoodHabit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  const baseButtonClass = "w-full text-white";
  const goodHabitButtonClass = `bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700`;
  const badHabitButtonClass = `bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700`; // For "Kept Streak" on bad habit

  const goodHabitLoggedButtonClass = `bg-green-700 dark:bg-green-800 cursor-not-allowed`;
  const badHabitLoggedButtonClass = `bg-slate-500 dark:bg-slate-600 cursor-not-allowed`;


  const buttonClass = isGoodHabit ? goodHabitButtonClass : badHabitButtonClass;
  const loggedButtonClass = isGoodHabit ? goodHabitLoggedButtonClass : badHabitLoggedButtonClass;

  // For BAD habits, "Failed Today" button styling
  const badHabitFailButtonOutline = `border-red-500 text-red-500 hover:bg-red-50 dark:border-red-700 dark:text-red-500 dark:hover:bg-red-900/50`;
  const badHabitFailButtonLogged = `border-slate-400 text-slate-400 dark:border-slate-600 dark:text-slate-600 cursor-not-allowed`;

  return (
    <Card className={`flex flex-col h-full ${cardBorderColor} border-2 shadow-md hover:shadow-lg transition-shadow duration-200`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow">
            <CardTitle className="text-lg font-semibold leading-tight">{name}</CardTitle>
            <CardDescription className={`${accentColor} font-medium text-xs`}>
              {isGoodHabit ? 'Tracker' : 'Breaker'} - {goalType}
            </CardDescription>
          </div>
          <div className="flex flex-shrink-0 space-x-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit && onEdit(id)} aria-label="Edit habit">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete && onDelete(id)} aria-label="Delete habit">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-4">
        {description && <p className="text-sm text-muted-foreground mb-3 leading-snug">{description}</p>}

        <div className="flex justify-between items-center mb-3 text-sm">
          <div className="flex items-center space-x-3">
            <span className="font-medium flex items-center">
              <Zap className={`h-4 w-4 mr-1 ${currentStreak > 0 ? (isGoodHabit ? 'text-yellow-500' : 'text-red-500') : 'text-muted-foreground'}`} />
              Streak: {currentStreak}
            </span>
            {successRate !== undefined && ( // Only show if successRate is provided
              <span className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                {(successRate * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDetailOpen(!isDetailOpen)} aria-label={isDetailOpen ? "Hide details" : "Show details"}>
            {isDetailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Quick Log Buttons */}
        <div className="flex space-x-2">
          {isGoodHabit && (
            <Button
              onClick={() => handleLog(true)}
              className={`${baseButtonClass} ${loggedToday ? loggedButtonClass : buttonClass}`}
              disabled={loggedToday}
              aria-label={loggedToday ? "Completed today" : "Mark as done for today"}
            >
              <CheckCircle className="mr-2 h-5 w-5" /> {loggedToday ? 'Done!' : 'Mark Done'}
            </Button>
          )}
          {!isGoodHabit && ( // Bad Habit
            <>
              <Button
                onClick={() => handleLog(true)} // True means success (avoided the bad habit)
                className={`${baseButtonClass} w-1/2 ${loggedToday ? loggedButtonClass : buttonClass}`}
                disabled={loggedToday}
                aria-label={loggedToday ? "Avoided today" : "Mark as successfully avoided today"}
              >
                <CheckCircle className="mr-2 h-5 w-5" /> {loggedToday ? 'Avoided!' : 'Kept Streak'}
              </Button>
              <Button
                onClick={() => handleLog(false)} // False means failure (did the bad habit)
                variant="outline"
                className={`w-1/2 ${loggedToday ? badHabitFailButtonLogged : badHabitFailButtonOutline}`}
                disabled={loggedToday}
                aria-label={loggedToday ? "Failed today (already logged)" : "Log as failed today"}
              >
                <XCircle className="mr-2 h-5 w-5" /> Failed
              </Button>
            </>
          )}
        </div>

        {isDetailOpen && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">PAST WEEK ACTIVITY (PLACEHOLDER)</h4>
            <div className="flex justify-between items-center space-x-1">
              {[...Array(7)].map((_, i) => (
                <span key={i} className="flex items-center justify-center h-6 w-6 text-xs bg-muted/50 dark:bg-muted/20 rounded-sm p-1">
                  {/* Placeholder: could be a dot, check, or X */}
                  <CheckCircle className="h-3 w-3 text-green-500 opacity-30" />
                </span>
              ))}
            </div>
             <p className="text-xs text-muted-foreground mt-2 text-center">Actual daily logs will be shown here.</p>
          </div>
        )}
      </CardContent>
      {/* Optional Footer for things like 'Created on X' or tags */}
      {/* <CardFooter className="text-xs text-muted-foreground pt-2 pb-3 border-t">
          <p>Tags: {tags.join(', ') || 'None'}</p>
      </CardFooter> */}
    </Card>
  );
};

export default HabitCard;
