const palette = {
  // "Night Journey" Progression
  electricBlue: '#33FFFF',
  violet: '#7F00FF',
  silver: '#C0C0C0',

  // "Day Growth" Progression
  red: '#FF4136',
  orange: '#FF851B',
  yellow: '#FFDC00',
  gold: '#FFD700',

  // Neutrals
  nightBackground: '#0D0D0D',
  dayBackground: '#FFFFFF',
  black: '#000000',
  white: '#FFFFFF',
};

export const darkTheme = {
  background: palette.nightBackground,
  text: palette.white,
  primary: palette.electricBlue,
  secondary: palette.violet,
  accent: palette.silver,
};

export const lightTheme = {
  background: palette.dayBackground,
  text: palette.black,
  primary: palette.red,
  secondary: palette.orange,
  accent: palette.gold,
};

export type Theme = typeof lightTheme;
