import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PillarsScreen from './screens/PillarsScreen';
import { darkTheme } from './themes/colors';

export default function App() {
  // In a real app, you would have state to switch between darkTheme and lightTheme
  const theme = darkTheme;

  return (
    <SafeAreaProvider>
      <PillarsScreen />
      <StatusBar style={theme === darkTheme ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
