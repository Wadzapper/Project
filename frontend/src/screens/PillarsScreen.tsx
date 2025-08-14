import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { Pillar, Skill } from '../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { darkTheme } from '../themes/colors';
import { spacing } from '../themes/spacing';

const MOCK_PILLARS: Pillar[] = [
  {
    id: '1',
    name: 'Health',
    skills: [
      { id: 's1', name: 'Meditation', level: 5, xp: 1200 },
      { id: 's2', name: 'Running', level: 3, xp: 450 },
    ],
  },
  {
    id: '2',
    name: 'Learning',
    skills: [
      { id: 's3', name: 'Coding', level: 8, xp: 5000 },
      { id: 's4', name: 'Reading', level: 6, xp: 2000 },
    ],
  },
];

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
      {item.skills.map(skill => <SkillItem key={skill.id} item={skill} />)}
      <View style={{ marginTop: spacing.m }}>
        <Button title="Add Quest" onPress={() => console.log('Add Quest for', item.name)} />
      </View>
    </Card>
  </View>
);

const PillarsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={MOCK_PILLARS}
        renderItem={({ item }) => <PillarCard item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
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
