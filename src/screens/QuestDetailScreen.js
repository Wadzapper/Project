import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { firestore } from '../services/firebaseInit'; // Direct access for specific doc
import { getCurrentUser } from '../services/firebaseAuth';
import { updateSubTaskCompletion, completeQuest } from '../services/firestoreService';
import { useFocusEffect } from '@react-navigation/native';
import { lightThemeColors, darkThemeColors } from '../constants/colors';

const QuestDetailScreen = ({ route, navigation }) => {
  const { questId, questTitle } = route.params;
  const { colors, isDarkMode } = getAppTheme();
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUser = getCurrentUser();

  const fetchQuestDetails = useCallback(() => {
    if (currentUser && questId) {
      setLoading(true);
      const questRef = firestore.collection('users').doc(currentUser.uid).collection('quests').doc(questId);
      const unsubscribe = questRef.onSnapshot(
        (doc) => {
          if (doc.exists) {
            setQuest({ id: doc.id, ...doc.data() });
          } else {
            Alert.alert("Error", "Quest not found or access denied.");
            navigation.goBack();
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching quest details:", error);
          Alert.alert("Error", "Could not fetch quest details.");
          setLoading(false);
          navigation.goBack();
        }
      );
      return unsubscribe;
    } else {
      setLoading(false);
      navigation.goBack(); // Should not happen if navigation is set up correctly
      return () => {};
    }
  }, [currentUser?.uid, questId, navigation]);

  useFocusEffect(fetchQuestDetails); // Refreshes when screen comes into focus

  const handleToggleSubTask = async (index) => {
    if (!quest || !quest.subTasks || index < 0 || index >= quest.subTasks.length) return;
    const currentStatus = quest.subTasks[index].completed;
    try {
      await updateSubTaskCompletion(quest.id, index, !currentStatus);
      // Firestore listener will update the UI
    } catch (error) {
      console.error("QuestDetailScreen: Error updating sub-task", error);
    }
  };

  const handleCompleteQuest = async () => {
    if (!quest) return;
    // Check if all subtasks are done (client-side check, server-side also checks in `completeQuest`)
    if (quest.subTasks && quest.subTasks.length > 0) {
        const allSubTasksDone = quest.subTasks.every(st => st.completed);
        if (!allSubTasksDone) {
          Alert.alert("Sub-tasks Incomplete", "Please complete all sub-tasks before marking the quest as done.");
          return;
        }
      }

    Alert.alert(
      "Confirm Completion",
      `Are you sure you want to mark "${quest.title}" as complete?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Complete!",
          onPress: async () => {
            try {
              await completeQuest(quest.id);
              Alert.alert("Quest Completed!", `"${quest.title}" has been marked as complete.`);
              navigation.goBack(); // Go back after completion
            } catch (error) {
              // Error usually alerted from service
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, },
    scrollContainer: { padding: 20, },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 10, },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5, lineHeight: 22, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 15, marginBottom: 8, },
    subTaskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, },
    subTaskText: (completed) => ({ fontSize: 16, color: completed ? colors.secondaryText : colors.text, textDecorationLine: completed ? 'line-through' : 'none', marginLeft: 10, flex: 1, }),
    // Basic checkbox-like view
    checkbox: (completed) => ({ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, backgroundColor: completed ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 8, }),
    checkmark: { color: isDarkMode ? darkThemeColors.text : lightThemeColors.background, fontSize: 14, fontWeight: 'bold', }, // Ensure checkmark is visible
    completeButtonContainer: { marginTop: 25, marginBottom: 15, },
    editButton: { backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center', marginTop:10},
    editText: { color: isDarkMode ? darkThemeColors.text : lightThemeColors.text, fontWeight: 'bold', fontSize: 16},
  });

  useEffect(() => {
    // Set header title dynamically
    navigation.setOptions({ title: questTitle || 'Quest Details' });
  }, [navigation, questTitle]);


  if (loading || !quest) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.title}>{quest.title}</Text>
      {quest.description && <Text style={styles.detailText}>{quest.description}</Text>}
      <Text style={styles.detailText}><Text style={{fontWeight:'bold'}}>Type:</Text> {quest.type}</Text>
      <Text style={styles.detailText}><Text style={{fontWeight:'bold'}}>Status:</Text> {quest.status}</Text>
      <Text style={styles.detailText}><Text style={{fontWeight:'bold'}}>XP Reward:</Text> {quest.xpReward}</Text>
      {quest.dueDate && <Text style={styles.detailText}><Text style={{fontWeight:'bold'}}>Due:</Text> {new Date(quest.dueDate.seconds * 1000).toLocaleDateString()}</Text>}
      {/* TODO: Display linked skills */}

      {quest.subTasks && quest.subTasks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sub-Tasks ({quest.subTasks.filter(st => st.completed).length}/{quest.subTasks.length})</Text>
          {quest.subTasks.map((subTask, index) => (
            <TouchableOpacity key={index} style={styles.subTaskItem} onPress={() => quest.status === 'active' && handleToggleSubTask(index)} disabled={quest.status !== 'active'}>
              <View style={styles.checkbox(subTask.completed)}>
                {subTask.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.subTaskText(subTask.completed)}>{subTask.title}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {quest.status === 'active' && (
        <View style={styles.completeButtonContainer}>
          <Button title="Mark Quest as Complete" onPress={handleCompleteQuest} color={colors.success} />
        </View>
      )}

      {/* Placeholder for Edit Quest button */}
      {/* <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditQuest', { questId: quest.id })}>
          <Text style={styles.editText}>Edit Quest</Text>
      </TouchableOpacity> */}
    </ScrollView>
  );
};

export default QuestDetailScreen;
