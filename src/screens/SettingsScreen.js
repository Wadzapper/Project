import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { getAppTheme } from '../constants/theme';
// import { useTheme } from '../constants/theme'; // When ThemeContext is fully implemented

const SettingsScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  // const { toggleTheme } = useTheme(); // When ThemeContext is implemented

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
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingText: {
      fontSize: 18,
      color: colors.text,
    },
    // Add more styles as needed
  });

  const handleThemeToggle = () => {
    // toggleTheme(); // This will be the actual function from ThemeContext
    console.log("Toggle theme pressed. Current isDarkMode:", isDarkMode);
    alert("Theme toggling will be fully implemented with ThemeContext later!");
    // For now, this button is a placeholder. Actual theme switching requires re-rendering the app
    // with the new theme context, which `getAppTheme()` doesn't handle dynamically by itself.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Dark Mode</Text>
        <Button
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          onPress={handleThemeToggle}
          color={colors.accent}
        />
        {/* Ideally, this would be a Switch component:
        <Switch
          trackColor={{ false: "#767577", true: colors.primary }}
          thumbColor={isDarkMode ? colors.accent : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={handleThemeToggle}
          value={isDarkMode}
        />
        */}
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Account</Text>
        {/* Placeholder for account related settings */}
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Notifications</Text>
        {/* Placeholder for notification settings */}
      </View>

      {/* Add more settings items here */}

    </View>
  );
};

export default SettingsScreen;
