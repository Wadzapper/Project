export interface SkillLevelInfo {
  currentLevel: number;
  currentXp: number;
  targetXpForNextLevel: number;
}

// Calculates the XP required for the next level based on the current level.
// Example formula: (currentLevel * 100) + 50;  (e.g. Lvl 1 -> 150XP, Lvl 2 -> 250XP)
// Another common one: Math.floor(100 * Math.pow(1.1, currentLevel -1))
export function calculateTargetXpForLevel(level: number): number {
  if (level <= 0) return 100; // Should not happen if level starts at 1
  return (level * 100) + 50 * level; // Example: L1=150, L2=300, L3=450
  // return Math.floor(100 * Math.pow(1.2, level -1) + (level > 1 ? 50 * (level -1) : 0 ));
}

export function calculateLevelUp(
  currentSkillInfo: SkillLevelInfo,
  xpGained: number
): SkillLevelInfo {
  let newLevel = currentSkillInfo.currentLevel;
  let newXp = currentSkillInfo.currentXp + xpGained;
  let newTargetXp = currentSkillInfo.targetXpForNextLevel;

  // Ensure targetXpForNextLevel is correct for the current level if it wasn't already
  // This helps if the formula changes or data was inconsistent.
  if (newTargetXp !== calculateTargetXpForLevel(newLevel) && xpGained > 0) { // only recalculate if XP is being gained
      newTargetXp = calculateTargetXpForLevel(newLevel);
  }


  // Handle XP gain and potential level ups
  if (xpGained > 0) {
    while (newXp >= newTargetXp) {
      newLevel += 1;
      newXp -= newTargetXp; // Remaining XP after level up
      newTargetXp = calculateTargetXpForLevel(newLevel);
    }
  } else if (xpGained < 0) { // Handle XP loss (optional: de-leveling)
    // Basic XP loss without de-leveling for now. newXp can go negative.
    // Or clamp at 0 for the current level: newXp = Math.max(0, newXp);
    // De-leveling logic:
    // while (newXp < 0) {
    //   if (newLevel <= 1) {
    //     newXp = 0; // Cannot go below level 1, XP 0
    //     break;
    //   }
    //   newLevel -= 1;
    //   const previousLevelTargetXp = calculateTargetXpForLevel(newLevel);
    //   newXp += previousLevelTargetXp; // Add the XP requirement of the new (lower) level
    //   newTargetXp = previousLevelTargetXp;
    // }
    // For MVP, let's just allow XP to decrease, but not de-level automatically from AddXP.
    // We can clamp XP at 0 if desired:
    if (newXp < 0 && newLevel === 1) newXp = 0; // Cannot go below 0 XP at level 1
    // More complex deleveling can be added later.
  }

  // If level didn't change but XP did, target remains for current level
  if (newLevel === currentSkillInfo.currentLevel && xpGained !==0) {
      newTargetXp = calculateTargetXpForLevel(newLevel);
  }


  return {
    currentLevel: newLevel,
    currentXp: newXp,
    targetXpForNextLevel: newTargetXp,
  };
}

// Recalculates level info if level or XP is manually set, ensuring consistency.
export function recalculateSkillStats(
  level: number,
  xp: number
): SkillLevelInfo {
    let currentLevel = level;
    let currentXp = xp;
    let targetXpForNextLevel = calculateTargetXpForLevel(currentLevel);

    // Adjust if XP exceeds target for current level (level up)
    while (currentXp >= targetXpForNextLevel) {
        currentLevel += 1;
        currentXp -= targetXpForNextLevel;
        targetXpForNextLevel = calculateTargetXpForLevel(currentLevel);
    }

    // Adjust if XP is negative (de-level, more complex, for now clamp at 0 for level 1)
    // This part needs careful thought if de-leveling is a feature.
    // For now, if XP is negative, it assumes it's within the current level's negative range
    // or clamps at L1/0XP.
    if (currentLevel === 1 && currentXp < 0) {
        currentXp = 0;
    }
    // If we allow setting level directly, ensure XP is valid for that level
    // e.g. if user sets level to 5, XP should be 0 for level 5, or a value within its range.
    // For simplicity, if level is changed, we might reset XP for that new level to 0.
    // Or, ensure targetXpForNextLevel is correct for the given level.

    // If level was manually changed, ensure targetXP is correct for the *new* level
    // and XP is within bounds (e.g. 0 to targetXpForNextLevel -1)
    // This function is more for when user directly edits level/XP in the form.
    targetXpForNextLevel = calculateTargetXpForLevel(currentLevel);
    if (currentXp >= targetXpForNextLevel) currentXp = targetXpForNextLevel -1; // cap XP
    if (currentXp < 0 && currentLevel > 1) currentXp = 0; // don't allow negative XP above level 1 easily via direct edit

    return {
        currentLevel,
        currentXp,
        targetXpForNextLevel,
    };
}

// --- Color Utilities ---
// Basic level-to-color mapping (Tailwind classes)
// Ensure these colors provide good contrast in both light and dark themes.
const levelColorClasses = [
  'bg-gray-400 dark:bg-gray-600 text-white dark:text-gray-100',      // Level 0 or undefined (fallback)
  'bg-blue-500 dark:bg-blue-700 text-white',                          // Level 1
  'bg-green-500 dark:bg-green-700 text-white',                        // Level 2
  'bg-yellow-500 dark:bg-yellow-600 text-black dark:text-gray-900',    // Level 3 (adjust text for light bg)
  'bg-orange-500 dark:bg-orange-600 text-white',                      // Level 4
  'bg-red-500 dark:bg-red-700 text-white',                            // Level 5
  'bg-purple-500 dark:bg-purple-700 text-white',                      // Level 6
  'bg-pink-500 dark:bg-pink-700 text-white',                          // Level 7+
  // Add more as needed, or use a formula
];

export function getSkillColorClass(level: number): string {
  if (level < 1) return levelColorClasses[0]; // Use index 0 for level 0 or less
  return levelColorClasses[Math.min(level, levelColorClasses.length -1)]; // Use level directly as index (1-based) up to array length
}
