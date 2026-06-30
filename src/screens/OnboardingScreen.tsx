import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings, saveSettings } from '../storage';
import TutorialSlides from '../components/TutorialSlides';

type Props = {
  onDone: () => void;
};

export default function OnboardingScreen({ onDone }: Props) {
  const [name, setName] = useState('');

  const handleDone = async () => {
    if (!name.trim()) {
      Alert.alert('Ange ditt namn', 'Fyll i ditt förnamn för att komma igång.');
      return;
    }
    const settings = await getSettings();
    await saveSettings({ ...settings, userName: name.trim(), onboardingDone: true });
    onDone();
  };

  return (
    <SafeAreaView style={st.container} edges={['top', 'bottom']}>
      <View style={st.header}>
        <Text style={st.logo}>🔨</Text>
        <Text style={st.appName}>Hantverkarschema</Text>
        <Text style={st.sub}>Lär dig grunderna på 2 minuter</Text>
      </View>
      <TutorialSlides
        showNameInput
        nameValue={name}
        onNameChange={setName}
        onDone={handleDone}
        doneLabel="Kom igång! →"
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#1A3057', alignItems: 'center', paddingTop: 24, paddingBottom: 28 },
  logo: { fontSize: 36, marginBottom: 6 },
  appName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 13, color: '#93C5FD' },
});
