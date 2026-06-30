import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Text style={st.title}>Jobbkarta</Text>
      </View>
      <View style={st.body}>
        <Text style={st.icon}>📍</Text>
        <Text style={st.heading}>Karta kräver mobilapp</Text>
        <Text style={st.sub}>
          Kartfunktionen använder Apple Maps och GPS som inte är tillgängliga i webbläsaren.{'\n'}
          Ladda ner appen på din iPhone för att se jobben på kartan.
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { backgroundColor: '#1A3057', padding: 20, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 64, marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: '#1A3057', marginBottom: 12, textAlign: 'center' },
  sub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
});
