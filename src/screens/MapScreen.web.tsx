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
        <Text style={st.badge}>DEMO</Text>
        <Text style={st.heading}>Kartvy ej tillgänglig i demo</Text>
        <Text style={st.sub}>
          Den här webbversionen är en demonstration av appens övriga funktioner.{'\n\n'}
          En fullständig iOS-app med interaktiv karta, GPS-navigering och Apple Maps-integration är under utveckling och kommer att lanseras framöver.
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
  icon: { fontSize: 64, marginBottom: 16 },
  badge: { fontSize: 11, fontWeight: '700', color: '#D4822A', letterSpacing: 2, borderWidth: 1, borderColor: '#D4822A', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#1A3057', marginBottom: 12, textAlign: 'center' },
  sub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
});
