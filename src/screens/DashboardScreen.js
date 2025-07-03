import React from 'react';
import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';
import { getAppTheme } from '../constants/theme';

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Button, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { getCurrentUser, logoutUser } from '../services/firebaseAuth';
import { getUserProfile, getTasks, addTask, completeTask } from '../services/firestoreService';
import { lightThemeColors, darkThemeColors } from '../constants/colors'; // For loader color

const DashboardScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    let profileUnsubscribe = null;
    let tasksUnsubscribe = null;

    if (currentUser) {
      setLoadingProfile(true);
      profileUnsubscribe = getUserProfile(currentUser.uid, (profile) => {
        setUserProfile(profile);
        setLoadingProfile(false);
      });

      setLoadingTasks(true);
      tasksUnsubscribe = getTasks((fetchedTasks) => {
        setTasks(fetchedTasks);
        setLoadingTasks(false);
      });
    } else {
      // Should not happen if navigator is working correctly, but handle defensively
      setLoadingProfile(false);
      setLoadingTasks(false);
      // navigation.replace('Auth'); // Or handle as an error
    }

    return () => {
      if (profileUnsubscribe) profileUnsubscribe();
      if (tasksUnsubscribe) tasksUnsubscribe();
    };
  }, [currentUser?.uid]); // Rerun if currentUser UID changes (e.g. re-login)

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Task Title Empty', 'Please enter a title for your task.');
      return;
    }
    setIsAddingTask(true);
    try {
      await addTask(newTaskTitle.trim());
      setNewTaskTitle(''); // Clear input
    } catch (error) {
      // Error already alerted in service
      console.log("Dashboard: Error adding task", error);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await completeTask(taskId);
      // UI will update via onSnapshot listener for tasks (or could manually refresh)
    } catch (error) {
      // Error already alerted in service
      console.log("Dashboard: Error completing task", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      // Navigation to Auth screen will be handled by onAuthStateChanged in AppNavigator
    } catch (error) {
      Alert.alert('Logout Failed', 'An error occurred while logging out.');
    }
  };


  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { padding: 20 },
    header: { fontSize: 26, fontWeight: 'bold', color: colors.primary, marginBottom: 10, },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 20, marginBottom: 10, },
    card: { backgroundColor: colors.card, borderRadius: 8, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2, },
    xpBarContainer: { height: 20, backgroundColor: colors.border, borderRadius: 10, overflow: 'hidden', marginTop: 5, },
    xpBarFill: { height: '100%', backgroundColor: colors.xpBarFill, borderRadius: 10, },
    text: { fontSize: 16, color: colors.text, marginBottom: 5, },
    secondaryText: { fontSize: 14, color: colors.secondaryText, },
    input: { width: '100%', height: 40, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, marginBottom: 10, color: colors.text, },
    taskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, },
    taskTitle: { fontSize: 16, color: colors.text, flex: 1, marginRight: 10, },
    completeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 5, },
    completeButtonText: { color: isDarkMode ? darkThemeColors.text : lightThemeColors.text, fontWeight: 'bold'}, // Ensure contrast
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, },
    buttonGroup: { marginTop: 10, marginBottom: 20, },
    buttonSpacer: { height: 10, },
  });

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} />
        <Text style={styles.text}>Loading Profile...</Text>
      </View>
    );
  }

  const xpPercentage = userProfile && userProfile.xpToNextLevel > 0 ? (userProfile.xp / userProfile.xpToNextLevel) * 100 : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollView}>
      <Text style={styles.header}>Welcome, {userProfile?.email || 'User'}!</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        {userProfile ? (
          <>
            <Text style={styles.text}>Level: {userProfile.level}</Text>
            <Text style={styles.text}>XP: {userProfile.xp} / {userProfile.xpToNextLevel}</Text>
            <View style={styles.xpBarContainer}>
              <View style={[styles.xpBarFill, { width: `${xpPercentage}%` }]} />
            </View>
          </>
        ) : <Text style={styles.text}>Profile data not available.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>My Tasks (MVP)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new task title"
          placeholderTextColor={colors.secondaryText}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          editable={!isAddingTask}
        />
        <Button title={isAddingTask ? "Adding..." : "Add Task"} onPress={handleAddTask} color={colors.primary} disabled={isAddingTask} />

        {loadingTasks ? (
          <ActivityIndicator style={{marginTop: 10}} size="small" color={colors.primary} />
        ) : tasks.length > 0 ? tasks.map(task => (
          <View key={task.id} style={styles.taskItem}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteTask(task.id)}>
                <Text style={styles.completeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )) : <Text style={[styles.text, {marginTop: 10}]}>No active tasks. Add one!</Text>}
      </View>

      <View style={styles.buttonGroup}>
        <Button title="Settings" onPress={() => navigation.navigate('Settings')} color={colors.accent}/>
        <View style={styles.buttonSpacer} />
        <Button title="Logout" onPress={handleLogout} color={colors.error} />
      </View>
    </ScrollView>
  );
};

export default DashboardScreen;
