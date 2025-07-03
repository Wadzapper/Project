import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { addSkill } from '../services/firestoreService';
import { lightThemeColors, darkThemeColors } from '../constants/colors'; // For loader color

const AddSkillScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [skillName, setSkillName] = useState('');
  const [category, setCategory] = useState('');
  // Future fields: icon, color
  const [loading, setLoading] = useState(false);

  const handleAddSkill = async () => {
    if (!skillName.trim()) {
      Alert.alert('Skill Name Required', 'Please enter a name for the skill.');
      return;
    }
    setLoading(true);
    try {
      await addSkill({
        name: skillName.trim(),
        category: category.trim() || 'General', // Default category if empty
        // icon: selectedIcon, // Future
        // color: selectedColor, // Future
      });
      Alert.alert('Skill Added!', `${skillName} has been added to your skills.`);
      setSkillName('');
      setCategory('');
      navigation.goBack(); // Go back to SkillsScreen
    } catch (error) {
      // Error already alerted in service
      console.error("AddSkillScreen: Error adding skill", error);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 20,
      textAlign: 'center',
    },
    label: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
      marginTop: 10,
    },
    input: {
      width: '100%',
      height: 50,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 15,
      fontSize: 16,
      color: colors.text,
      marginBottom: 15,
    },
    buttonContainer: {
      marginTop: 20,
    },
    loadingContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Skill</Text>

      <Text style={styles.label}>Skill Name*</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Programming, Fitness, Meditation"
        placeholderTextColor={colors.secondaryText || '#888'}
        value={skillName}
        onChangeText={setSkillName}
        editable={!loading}
      />

      <Text style={styles.label}>Category (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Work, Health, Personal Growth"
        placeholderTextColor={colors.secondaryText || '#888'}
        value={category}
        onChangeText={setCategory}
        editable={!loading}
      />

      {/* Placeholders for Icon and Color pickers in the future */}
      {/* <Text style={styles.label}>Icon (Optional)</Text> */}
      {/* <Text style={styles.label}>Color (Optional)</Text> */}

      <View style={styles.buttonContainer}>
        <Button
          title={loading ? "Adding..." : "Add Skill"}
          onPress={handleAddSkill}
          color={colors.primary}
          disabled={loading}
        />
      </View>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} />
        </View>
      )}
    </View>
  );
};

export default AddSkillScreen;
