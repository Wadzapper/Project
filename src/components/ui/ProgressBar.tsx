'use client'; // No client-specific hooks needed, but can be if animations are added

interface ProgressBarProps {
  currentValue: number;
  maxValue: number;
  colorClass?: string; // e.g., 'bg-blue-500'
  heightClass?: string; // e.g., 'h-2'
}

export default function ProgressBar({
  currentValue,
  maxValue,
  colorClass = 'bg-green-500', // Default progress bar color
  heightClass = 'h-2.5', // Default height
}: ProgressBarProps) {
  const percentage = maxValue > 0 ? Math.min((currentValue / maxValue) * 100, 100) : 0;

  return (
    <div className={`w-full bg-gray-200 rounded-full dark:bg-gray-700 ${heightClass}`}>
      <div
        className={`${colorClass} ${heightClass} rounded-full text-xs text-white text-center leading-none`}
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={currentValue}
        aria-valuemin={0}
        aria-valuemax={maxValue}
      >
       {/* Optional: Display percentage text if space allows and desired */}
       {/* {`${Math.round(percentage)}%`} */}
      </div>
    </div>
  );
}
