import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApolloProvider } from '@apollo/client';

import client from './lib/apollo';
import PillarsScreen from './screens/PillarsScreen';
import { darkTheme } from './themes/colors';

export default function App() {
  const theme = darkTheme;

  return (
    <ApolloProvider client={client}>
      <SafeAreaProvider>
        <PillarsScreen />
        <StatusBar style={theme === darkTheme ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </ApolloProvider>
  );
}
