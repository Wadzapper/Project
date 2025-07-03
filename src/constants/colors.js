export const lightThemeColors = {
  background: '#FFFFFF', // White background
  primary: '#FF6B6B', // Flame-inspired primary (e.g., for buttons, active elements)
  text: '#333333', // Dark gray text
  secondaryText: '#555555', // Lighter gray text
  accent: '#FFAA4C', // Softer flame/sun accent
  cardBackground: '#FFF0E1', // Light warm color for cards
  borderColor: '#FFD1A1',
  // ... any other colors needed for light mode
};

export const darkThemeColors = {
  background: '#0A192F', // Deep ocean/night blue
  primary: '#3A8DFF', // Bright, clear blue (like moonlight on water)
  text: '#E0E0E0', // Light gray/off-white text
  secondaryText: '#B0B0B0', // Softer light gray text
  accent: '#57C4E5', // Lighter ocean/sky blue accent
  cardBackground: '#162B4D', // Darker blue for cards, like deeper water
  borderColor: '#2A4C7B',
  // ... any other colors needed for dark mode
};

export const commonColors = {
  xpBarFill: '#4CAF50', // Green for XP bar (consistent across themes)
  error: '#D32F2F', // Red for error messages
  success: '#388E3C', // Green for success messages
};

// Function to get theme (can be expanded later with context/state management)
// For now, let's default to light theme or allow a simple toggle mechanism later.
export const getTheme = (isDarkMode = false) => {
  return isDarkMode ? darkThemeColors : lightThemeColors;
};
