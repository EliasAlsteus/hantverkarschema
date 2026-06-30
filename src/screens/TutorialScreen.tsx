import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TutorialSlides from '../components/TutorialSlides';

export default function TutorialScreen({ navigation }: any) {
  return (
    <SafeAreaView style={st.container} edges={[]}>
      <TutorialSlides
        onDone={() => navigation.goBack()}
        doneLabel="Stäng tutorial"
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
