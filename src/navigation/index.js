// Placeholder for navigation setup
// We'll use React Navigation here later
// e.g., createStackNavigator, createBottomTabNavigator

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens (will be created later)
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
// import AddTaskScreen from '../screens/AddTaskScreen'; // Will create later
import SettingsScreen from '../screens/SettingsScreen'; // For theme toggle etc.

// import { Text, View } from 'react-native'; // No longer needed for temp screens
import { getAppTheme } from '../constants/theme'; // To use theme in navigator


const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isDarkMode, colors } = getAppTheme(); // Get theme for navigator styling

  // For MVP, let's assume a simple flow: Auth -> Dashboard
  // We'll add more screens and logic as we build
  const isAuthenticated = false; // This will come from auth state later

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary, // Use primary color for header
          },
          headerTintColor: colors.text, // Text color for header (let's use the theme's main text color for contrast with primary)
          // headerTintColor: isDarkMode ? darkThemeColors.text : lightThemeColors.text, // Alternative
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background, // Set background for screen content area
          }
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            {/* <Stack.Screen name="AddTask" component={AddTaskScreen} /> */}
            {/* Add other authenticated screens here */}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
