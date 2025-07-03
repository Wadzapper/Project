import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

// Import screens
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SkillsScreen from '../screens/SkillsScreen';
import AddSkillScreen from '../screens/AddSkillScreen';
import QuestsScreen from '../screens/QuestsScreen'; // Import QuestsScreen
import AddQuestScreen from '../screens/AddQuestScreen'; // Import AddQuestScreen
import QuestDetailScreen from '../screens/QuestDetailScreen'; // Import QuestDetailScreen
// import AddTaskScreen from '../screens/AddTaskScreen';

import { getAppTheme } from '../constants/theme';
import { onAuthStateChanged } from '../services/firebaseAuth';
import { lightThemeColors, darkThemeColors } from '../constants/colors';


const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isDarkMode, colors } = getAppTheme();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const subscriber = onAuthStateChanged(authUser => {
      setUser(authUser);
      if (initializing) {
        setInitializing(false);
      }
    });
    return subscriber;
  }, []); // Removed initializing from dependency array, useEffect runs once.

  if (initializing) {
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
        {user ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Skills" component={SkillsScreen} options={{ title: 'My Skills' }} />
            <Stack.Screen name="AddSkill" component={AddSkillScreen} options={{ title: 'Add New Skill' }}/>
            <Stack.Screen name="Quests" component={QuestsScreen} options={{ title: 'My Quests' }} />
            <Stack.Screen name="AddQuest" component={AddQuestScreen} options={{ title: 'Create New Quest' }}/>
            <Stack.Screen name="QuestDetail" component={QuestDetailScreen} />
            {/* options for QuestDetail title can be set dynamically in the component */}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
