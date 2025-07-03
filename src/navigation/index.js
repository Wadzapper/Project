// Placeholder for navigation setup
// We'll use React Navigation here later
// e.g., createStackNavigator, createBottomTabNavigator

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native'; // For loading state

// Import screens
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SkillsScreen from '../screens/SkillsScreen';
import AddSkillScreen from '../screens/AddSkillScreen';
// import AddTaskScreen from '../screens/AddTaskScreen'; // Will create later

import { getAppTheme } from '../constants/theme'; // To use theme in navigator
import { onAuthStateChanged } from '../services/firebaseAuth'; // Import the listener
import { lightThemeColors, darkThemeColors } from '../constants/colors'; // For loader color


const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isDarkMode, colors } = getAppTheme();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Handle user state changes
  useEffect(() => {
    const subscriber = onAuthStateChanged(authUser => {
      setUser(authUser);
      if (initializing) {
        setInitializing(false);
      }
    });
    return subscriber; // Unsubscribe on unmount
  }, [initializing]); // Only re-run if initializing changes (which is once)

  if (initializing) {
    // Show a loading screen while checking auth state
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          }
        }}
      >
        {user ? ( // If user is logged in
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Skills" component={SkillsScreen} options={{ title: 'My Skills' }} />
            <Stack.Screen name="AddSkill" component={AddSkillScreen} options={{ title: 'Add New Skill' }}/>
            {/* <Stack.Screen name="AddTask" component={AddTaskScreen} /> */}
          </>
        ) : (
          // No user found, show the auth screen
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
