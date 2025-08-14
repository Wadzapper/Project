import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../themes/spacing';
import { darkTheme } from '../themes/colors';

interface CardProps {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children }) => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: darkTheme.background,
    borderWidth: 1,
    borderColor: darkTheme.accent,
    borderRadius: spacing.m,
    padding: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default Card;
