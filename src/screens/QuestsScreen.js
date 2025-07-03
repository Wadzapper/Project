import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { getQuests, completeQuest } from '../services/firestoreService'; // Assuming 'completeQuest' is ready
import { getCurrentUser } from '../services/firebaseAuth';
import { useFocusEffect } from '@react-navigation/native'; // To refresh data on screen focus
import { lightThemeColors, darkThemeColors } from '../constants/colors';

const QuestsScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'completed', 'all'
  const currentUser = getCurrentUser();

  const fetchQuests = useCallback(() => {
    if (currentUser) {
      setLoading(true);
      const unsubscribe = getQuests(filter, (fetchedQuests) => {
        setQuests(fetchedQuests);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      setQuests([]);
      setLoading(false);
      return () => {};
    }
  }, [currentUser, filter]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = fetchQuests();
      return () => unsubscribe();
    }, [fetchQuests])
  );

  const handleCompleteQuest = async (questId, questTitle) => {
    Alert.alert(
      "Confirm Completion",
      `Are you sure you want to mark "${questTitle}" as complete?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Complete!",
          onPress: async () => {
            try {
              await completeQuest(questId);
              // The list will refresh due to the onSnapshot listener in getQuests
              Alert.alert("Quest Completed!", `"${questTitle}" has been marked as complete.`);
            } catch (error) {
              // Error is usually alerted from the service
              console.error("QuestsScreen: Failed to complete quest", error);
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 15, paddingTop: 10, },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, },
    header: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 15, textAlign: 'center', },
    filterContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, },
    filterButton: (isActive) => ({
      paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20,
      backgroundColor: isActive ? colors.primary : colors.card,
      borderColor: isActive ? colors.primary : colors.border,
      borderWidth: 1,
    }),
    filterButtonText: (isActive) => ({ color: isActive ? (isDarkMode ? darkThemeColors.text : lightThemeColors.text) : colors.text, fontWeight: '600' }),
    questItem: { backgroundColor: colors.card, borderRadius: 8, padding: 15, marginBottom: 10, elevation: 1, },
    questTitle: { fontSize: 18, fontWeight: '600', color: colors.text, },
    questDetailText: { fontSize: 14, color: colors.secondaryText, marginTop: 4, },
    questStatus: { fontStyle: 'italic', color: colors.accent, marginTop: 4, },
    subTasksContainer: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border },
    subTaskItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 2, },
    subTaskText: (completed) => ({ fontSize: 14, color: completed ? colors.secondaryText : colors.text, textDecorationLine: completed ? 'line-through' : 'none', marginLeft: 5, }),
    actionsContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, },
    actionButton: { marginLeft: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 5, },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4, },
    fabText: { fontSize: 30, color: isDarkMode ? darkThemeColors.text : lightThemeColors.text, lineHeight: 30, },
    emptyText: { textAlign: 'center', fontSize: 16, color: colors.secondaryText, marginTop: 50, paddingHorizontal: 20, },
  });

  if (loading && !quests.length) { // Show full screen loader only if no data yet
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} /></View>;
  }

  const renderQuestItem = ({ item }) => (
    <TouchableOpacity style={styles.questItem} onPress={() => navigation.navigate('QuestDetail', { questId: item.id, questTitle: item.title })}>
      <Text style={styles.questTitle}>{item.title}</Text>
      {item.description && <Text style={styles.questDetailText}>{item.description.substring(0,100)}{item.description.length > 100 ? '...' : ''}</Text>}
      <Text style={styles.questDetailText}>Type: {item.type}</Text>
      <Text style={styles.questDetailText}>XP Reward: {item.xpReward}</Text>
      {item.status !== 'active' && <Text style={styles.questStatus}>Status: {item.status}</Text>}
      {item.subTasks && item.subTasks.length > 0 && (
        <View style={styles.subTasksContainer}>
          <Text style={styles.questDetailText}>Sub-tasks: {item.subTasks.filter(st => st.completed).length} / {item.subTasks.length} done</Text>
        </View>
      )}
      {item.status === 'active' && (
         <View style={styles.actionsContainer}>
            <TouchableOpacity
                style={[styles.actionButton, {backgroundColor: colors.success}]}
                onPress={() => handleCompleteQuest(item.id, item.title)}
            >
                <Text style={styles.filterButtonText(true)}>Complete</Text>
            </TouchableOpacity>
         </View>
      )}
    </TouchableOpacity>
  );

  const FilterButton = ({ title, status }) => (
    <TouchableOpacity style={styles.filterButton(filter === status)} onPress={() => setFilter(status)}>
      <Text style={styles.filterButtonText(filter === status)}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Quests</Text>
      <View style={styles.filterContainer}>
        <FilterButton title="Active" status="active" />
        <FilterButton title="Completed" status="completed" />
        <FilterButton title="All" status="all" />
      </View>
      {loading && quests.length > 0 && <ActivityIndicator size="small" color={colors.primary} style={{marginBottom: 10}}/>}
      {quests.length === 0 && !loading ? (
        <Text style={styles.emptyText}>
          No {filter !== 'all' ? filter : ''} quests found. Tap the '+' button to embark on a new adventure!
        </Text>
      ) : (
        <FlatList
          data={quests}
          renderItem={renderQuestItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddQuest')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

export default QuestsScreen;
