import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getAppTheme } from '../constants/theme'; // To use theme
import { lightThemeColors, darkThemeColors } from '../constants/colors'; // Import specific theme colors for loader
import { registerUser, loginUser } from '../services/firebaseAuth';

const AuthScreen = ({ navigation }) => {
  const { colors, isDarkMode } = getAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuthentication = async () => {
    if (!email || !password) {
      Alert.alert('Input Required', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await loginUser(email, password);
        // Successful login will trigger onAuthStateChanged listener in AppNavigator,
        // which will then navigate to the Dashboard.
        console.log('Login attempt finished from AuthScreen.');
      } else {
        await registerUser(email, password);
        Alert.alert('Registration Successful', 'Account created! Please log in.');
        setIsLogin(true);
      }
    } catch (error) {
      // Error messages are already handled by alerts in firebaseAuth.js
      console.log("AuthScreen: Authentication failed:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 30,
    },
    input: {
      width: '100%',
      height: 50,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 15,
      paddingHorizontal: 15,
      fontSize: 16,
      color: colors.text,
    },
    buttonContainer: {
      width: '100%',
      marginTop: 10,
      marginBottom: 20,
    },
    toggleText: {
      color: colors.accent,
      marginTop: 20,
      fontSize: 16,
    },
    loadingContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', // Themed overlay
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.secondaryText || '#888'}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.secondaryText || '#888'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <View style={styles.buttonContainer}>
        <Button
          title={isLogin ? 'Login' : 'Sign Up'}
          onPress={handleAuthentication}
          color={colors.primary}
          disabled={loading}
        />
      </View>
      <Text style={styles.toggleText} onPress={() => !loading && setIsLogin(!isLogin)}>
        {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
      </Text>
      {loading && (
        <View style={styles.loadingContainer}>
          {/* Use a contrasting color for the loader based on the theme */}
          <ActivityIndicator size="large" color={isDarkMode ? lightThemeColors.primary : darkThemeColors.primary} />
        </View>
      )}
    </View>
  );
};

export default AuthScreen;
