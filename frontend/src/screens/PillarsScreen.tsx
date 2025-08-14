import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { gql, useQuery } from '@apollo/client';
import { Pillar, Skill } from '../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { darkTheme } from '../themes/colors';
import { spacing } from '../themes/spacing';

const GET_PILLARS_QUERY = gql`
  query GetPillars {
    pillars {
      id
      name
      # The mock backend service doesn't populate skills yet.
      # This can be re-enabled when the backend is updated.
      # skills {
      #   id
      #   name
      #   level
      #   xp
      # }
    }
  }
`;

const SkillItem: React.FC<{ item: Skill }> = ({ item }) => (
  <View style={styles.skillContainer}>
    <Text style={styles.skillText}>{item.name} - Lvl {item.level}</Text>
    <Text style={styles.xpText}>{item.xp} XP</Text>
  </View>
);

const PillarCard: React.FC<{ item: Pillar }> = ({ item }) => (
  <View style={{ marginVertical: spacing.s }}>
    <Card>
      <Text style={styles.pillarTitle}>{item.name}</Text>
      {item.skills?.map(skill => <SkillItem key={skill.id} item={skill} />)}
      <View style={{ marginTop: spacing.m }}>
        <Button title="Add Quest" onPress={() => console.log('Add Quest for', item.name)} />
      </View>
    </Card>
  </View>
);

const PillarsScreen: React.FC = () => {
  const { data, loading, error } = useQuery<{ pillars: Pillar[] }>(GET_PILLARS_QUERY);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={darkTheme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error fetching data: {error.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={data?.pillars || []}
        renderItem={({ item }) => <PillarCard item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.errorText}>No pillars found.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkTheme.background,
  },
  errorText: {
    color: darkTheme.text,
    fontSize: 18,
  },
  listContent: {
    padding: spacing.m,
  },
  pillarTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkTheme.text,
    marginBottom: spacing.m,
  },
  skillContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.accent,
  },
  skillText: {
    fontSize: 18,
    color: darkTheme.text,
  },
  xpText: {
    fontSize: 16,
    color: darkTheme.accent,
  },
});

export default PillarsScreen;
