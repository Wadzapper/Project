import React from 'react';
// import { StatusBar } from 'expo-status-bar'; // If using Expo
import { StatusBar, LogBox } from 'react-native';
import AppNavigator from './src/navigation';
// import { ThemeProvider } from './src/constants/theme'; // We'll implement ThemeProvider properly later

// Suppress specific warnings that are common during development but not critical for now
LogBox.ignoreLogs([
  "Sending `onAnimatedValueUpdate` with no listeners registered.", // Common with some navigation/animation libraries
  // Add other warnings to ignore here if needed
]);


// Firebase imports - will be configured properly
// import firebase from '@react-native-firebase/app';
// import '@react-native-firebase/auth';
// import '@react-native-firebase/firestore';

// Firebase config (keys would typically be in a .env file and not hardcoded)
/*
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // if already initialized, use that one
}
*/

export default function App() {
  // const { isDarkMode } = useTheme(); // If ThemeProvider is set up

  // For now, StatusBar styling can be simple.
  // It can be dynamically changed later based on theme.
  // const currentScheme = Appearance.getColorScheme();
  // const isDarkMode = currentScheme === 'dark';

  return (
    // <ThemeProvider> // Wrap with ThemeProvider once context is fully set up
    <>
      <StatusBar barStyle={'light-content'} />
      {/* If using Expo: <StatusBar style={isDarkMode ? "light" : "dark"} /> */}
      {/* If not using Expo, barStyle can be 'default', 'light-content', or 'dark-content' */}
      {/* We'll need to manage this more dynamically with theme context later */}
      <AppNavigator />
    </>
    // </ThemeProvider>
  );
}
