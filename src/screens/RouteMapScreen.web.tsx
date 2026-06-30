import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RoutePoint = { name: string; address: string; lat: number; lng: number; driveFromPrevKm: number; workHours: number };

function formatDur(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

export default function RouteMapScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const points: RoutePoint[] = route?.params?.points ?? [];
  const dateLabel: string = route?.params?.dateLabel ?? '';

  const openGoogleMaps = () => {
    if (points.length === 0) return;
    const waypoints = points.map(p => encodeURIComponent(p.address)).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&waypoints=${waypoints}`;
    Linking.openURL(url);
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Text style={st.title}>Dagsrutt{dateLabel ? ` — ${dateLabel}` : ''}</Text>
      </View>
      <View style={st.body}>
        <Text style={st.icon}>🗺️</Text>
        <Text style={st.heading}>Rutt för {dateLabel}</Text>
        <View style={st.list}>
          {points.map((p, i) => (
            <View key={i} style={st.stop}>
              <Text style={st.stopNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.stopName}>{p.name}</Text>
                <Text style={st.stopAddr}>{p.address}</Text>
                <Text style={st.stopMeta}>{formatDur(p.workHours)}{p.driveFromPrevKm > 0 ? ` · ${Math.round(p.driveFromPrevKm)} km` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
        {points.length > 0 && (
          <TouchableOpacity style={st.mapsBtn} onPress={openGoogleMaps}>
            <Text style={st.mapsBtnTxt}>Öppna i Google Maps</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { backgroundColor: '#1A3057', padding: 20, paddingBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  body: { flex: 1, padding: 20 },
  icon: { fontSize: 40, marginBottom: 8, textAlign: 'center' },
  heading: { fontSize: 20, fontWeight: '800', color: '#1A3057', marginBottom: 16, textAlign: 'center' },
  list: { gap: 12, marginBottom: 24 },
  stop: { flexDirection: 'row', gap: 14, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  stopNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A3057', color: '#fff', textAlign: 'center', lineHeight: 28, fontWeight: '800', fontSize: 13 },
  stopName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  stopAddr: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  stopMeta: { fontSize: 12, color: '#9CA3AF' },
  mapsBtn: { backgroundColor: '#D4822A', borderRadius: 14, padding: 16, alignItems: 'center' },
  mapsBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
