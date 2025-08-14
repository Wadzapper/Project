import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { spacing } from '../themes/spacing';
import { darkTheme } from '../themes/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
}

const Button: React.FC<ButtonProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: darkTheme.primary,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: darkTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Button;
