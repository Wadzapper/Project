import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { getAppTheme } from '../constants/theme';
import { addQuest, getSkills } from '../services/firestoreService'; // Assuming getSkills is available
import { getCurrentUser } from '../services/firebaseAuth';
// import DateTimePicker from '@react-native-community/datetimepicker'; // For due date
// import { MultiSelect } from 'react-native-element-dropdown'; // For skill selection, or build custom

const questTypes = ["Main", "Side", "Daily", "Weekly"]; // Example types

const AddQuestScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(questTypes[0]); // Default to "Main"
  const [xpReward, setXpReward] = useState('50'); // Default XP, as string for input

  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  // For skillXpDistribution, we'd need a more complex UI, for now, let's keep it simple:
  // overall xpReward applies to user, and if skills are linked, maybe a fixed small XP per skill or shared.
  // For MVP of Quest System, direct skill XP distribution might be a V2 feature of this screen.

  const [subTasks, setSubTasks] = useState([{ title: '', completed: false }]);
  // const [dueDate, setDueDate] = useState(null);
  // const [showDatePicker, setShowDatePicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = getSkills((fetchedSkills) => {
        setAvailableSkills(fetchedSkills.map(skill => ({ label: skill.name, value: skill.id })));
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  const handleAddSubTask = () => {
    setSubTasks([...subTasks, { title: '', completed: false }]);
  };

  const handleSubTaskChange = (text, index) => {
    const newSubTasks = [...subTasks];
    newSubTasks[index].title = text;
    setSubTasks(newSubTasks);
  };

  const handleRemoveSubTask = (index) => {
    const newSubTasks = subTasks.filter((_, i) => i !== index);
    setSubTasks(newSubTasks);
  };

  const handleAddQuest = async () => {
    if (!title.trim() || !xpReward.trim() || isNaN(parseInt(xpReward))) {
      Alert.alert('Validation Error', 'Please enter a valid title and XP reward.');
      return;
    }
    setLoading(true);
    const finalSubTasks = subTasks.filter(st => st.title.trim() !== '');
    try {
      await addQuest({
        title: title.trim(),
        description: description.trim(),
        type,
        xpReward: parseInt(xpReward),
        skillIds: selectedSkillIds,
        // skillXpDistribution: [], // Future: UI to set this
        subTasks: finalSubTasks,
        // dueDate,
      });
      Alert.alert('Quest Added!', `"${title}" has been added.`);
      navigation.goBack();
    } catch (error) {
      console.error("AddQuestScreen: Error adding quest", error);
    } finally {
      setLoading(false);
    }
  };

  // Simple toggle for skill selection
  const toggleSkillSelection = (skillId) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const styles = StyleSheet.create({
    scrollContainer: { flexGrow: 1, backgroundColor: colors.background, },
    container: { padding: 20, },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 20, textAlign: 'center', },
    label: { fontSize: 16, color: colors.text, marginBottom: 5, marginTop: 10, },
    input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, color: colors.text, marginBottom: 15, },
    textArea: { height: 100, textAlignVertical: 'top', },
    pickerContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 15, },
    // Style for a custom picker or use a library like react-native-picker-select
    typePickerButton: { padding: 15, backgroundColor: colors.card, borderRadius: 8, marginBottom:15,},
    typePickerText: { fontSize: 16, color: colors.text },
    subTaskContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, },
    subTaskInput: { flex: 1, marginRight: 10, },
    skillsContainer: { marginBottom: 15, maxHeight: 150, borderWidth:1, borderColor: colors.border, borderRadius: 8, padding:5 },
    skillToggle: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', paddingVertical: 8, paddingHorizontal:10, marginVertical:2, backgroundColor: colors.card, borderRadius:5 },
    skillToggleText: {fontSize: 15, color: colors.text},
    buttonContainer: { marginTop: 20, },
  });

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create New Quest</Text>

      <Text style={styles.label}>Title*</Text>
      <TextInput style={styles.input} placeholder="e.g., Learn React Native Basics" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Details about the quest..." value={description} onChangeText={setDescription} multiline />

      <Text style={styles.label}>Type*</Text>
      {/* Basic Type Picker (can be improved with a modal or dropdown library) */}
      <View>
        {questTypes.map(qType => (
          <TouchableOpacity key={qType} onPress={() => setType(qType)} style={[styles.typePickerButton, type === qType && {backgroundColor: colors.primary}]}>
            <Text style={[styles.typePickerText, type === qType && {color: isDarkMode? darkThemeColors.text : lightThemeColors.text}]}>{qType}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Overall XP Reward*</Text>
      <TextInput style={styles.input} placeholder="e.g., 100" value={xpReward} onChangeText={setXpReward} keyboardType="number-pad" />

      <Text style={styles.label}>Link to Skills (Optional)</Text>
      <View style={styles.skillsContainer}>
        {availableSkills.length > 0 ? (
          <ScrollView nestedScrollEnabled>
            {availableSkills.map(skill => (
              <TouchableOpacity key={skill.value} onPress={() => toggleSkillSelection(skill.value)} style={styles.skillToggle}>
                <Text style={styles.skillToggleText}>{skill.label}</Text>
                <Switch
                    trackColor={{ false: "#767577", true: colors.primary }}
                    thumbColor={selectedSkillIds.includes(skill.value) ? colors.accent : "#f4f3f4"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => toggleSkillSelection(skill.value)}
                    value={selectedSkillIds.includes(skill.value)}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : <Text style={styles.typePickerText}>No skills available. Add skills first!</Text>}
      </View>

      <Text style={styles.label}>Sub-Tasks (Optional)</Text>
      {subTasks.map((st, index) => (
        <View key={index} style={styles.subTaskContainer}>
          <TextInput
            style={[styles.input, styles.subTaskInput]}
            placeholder={`Sub-task ${index + 1}`}
            value={st.title}
            onChangeText={(text) => handleSubTaskChange(text, index)}
          />
          {index > 0 && <Button title="-" onPress={() => handleRemoveSubTask(index)} color={colors.error} />}
        </View>
      ))}
      <Button title="Add Sub-Task" onPress={handleAddSubTask} color={colors.accent} />

      {/* Due Date Picker - Future
      <Text style={styles.label}>Due Date (Optional)</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <Text style={styles.input}>{dueDate ? dueDate.toLocaleDateString() : 'Select Date'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker value={dueDate || new Date()} mode="date" display="default" onChange={(event, selectedDate) => {setShowDatePicker(false); if(selectedDate) setDueDate(selectedDate);}} />
      )}
      */}

      <View style={styles.buttonContainer}>
        <Button title={loading ? "Creating..." : "Create Quest"} onPress={handleAddQuest} color={colors.primary} disabled={loading} />
      </View>
    </ScrollView>
  );
};

export default AddQuestScreen;
