import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { getSkills } from '../services/firestoreService';
import { getCurrentUser } from '../services/firebaseAuth';
import { lightThemeColors, darkThemeColors } from '../constants/colors'; // For loader color

const SkillsScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = getSkills((fetchedSkills) => {
        setSkills(fetchedSkills);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
      // Handle case where user is not logged in, though navigator should prevent this
    }
  }, [currentUser?.uid]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 15,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 20,
      textAlign: 'center',
    },
    skillItem: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.00,
      elevation: 1,
    },
    skillName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    skillDetailText: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 4,
    },
    xpBarContainer: {
      height: 10,
      backgroundColor: colors.border,
      borderRadius: 5,
      overflow: 'hidden',
      marginTop: 8,
    },
    xpBarFill: {
      height: '100%',
      backgroundColor: colors.xpBarFill,
      borderRadius: 5,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      backgroundColor: colors.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
    },
    fabText: {
      fontSize: 30,
      color: isDarkMode ? darkThemeColors.text : lightThemeColors.text, // Ensure contrast
      lineHeight: 30, // Adjust for vertical centering if needed
    },
    emptyText: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.secondaryText,
      marginTop: 50,
    }
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} />
      </View>
    );
  }

  const renderSkillItem = ({ item }) => {
    const xpPercentage = item.xpToNextLevel > 0 ? (item.xp / item.xpToNextLevel) * 100 : 0;
    return (
      <TouchableOpacity style={styles.skillItem} onPress={() => console.log("Navigate to Skill Detail:", item.id)}>
        <Text style={styles.skillName}>{item.name}</Text>
        <Text style={styles.skillDetailText}>Level: {item.level}</Text>
        <Text style={styles.skillDetailText}>XP: {item.xp} / {item.xpToNextLevel}</Text>
        <View style={styles.xpBarContainer}>
          <View style={[styles.xpBarFill, { width: `${xpPercentage}%` }]} />
        </View>
        {item.category && <Text style={styles.skillDetailText}>Category: {item.category}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Skills</Text>
      {skills.length === 0 ? (
        <Text style={styles.emptyText}>You haven't added any skills yet. Tap the '+' button to add your first skill!</Text>
      ) : (
        <FlatList
          data={skills}
          renderItem={renderSkillItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddSkill')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SkillsScreen;
