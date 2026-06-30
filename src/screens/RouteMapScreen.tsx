import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

type RoutePoint = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  potential: number;
  driveFromPrevKm: number;
  workHours: number;
};

function formatDur(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

export default function RouteMapScreen({ route }: any) {
  const {
    points,
    homeCoords,
    dateLabel,
  }: {
    points: RoutePoint[];
    homeCoords: { lat: number; lng: number } | null;
    dateLabel: string;
  } = route.params;

  const mapRef = useRef<MapView>(null);

  const withCoords = points.filter(p => p.lat !== 0 || p.lng !== 0);

  // Build polyline: home → job1 → job2 → ...
  const polylineCoords: { latitude: number; longitude: number }[] = [];
  if (homeCoords) polylineCoords.push({ latitude: homeCoords.lat, longitude: homeCoords.lng });
  withCoords.forEach(p => polylineCoords.push({ latitude: p.lat, longitude: p.lng }));

  const fitMap = () => {
    if (!mapRef.current || polylineCoords.length === 0) return;
    mapRef.current.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 60, right: 40, bottom: 200, left: 40 },
      animated: true,
    });
  };

  const openFullRoute = () => {
    if (withCoords.length === 0) return;
    const stops = withCoords.map(p => encodeURIComponent(p.address));
    const origin = homeCoords
      ? `${homeCoords.lat},${homeCoords.lng}`
      : stops[0];
    // Google Maps dir URL: /maps/dir/origin/stop1/stop2/destination
    const allStops = [origin, ...stops].join('/');
    const url = `https://www.google.com/maps/dir/${allStops}`;
    Linking.openURL(url).catch(() => {
      // Fallback: Apple Maps with just the first destination
      Linking.openURL(`maps://?saddr=&daddr=${stops[0]}`);
    });
  };

  const totalWork = points.reduce((s, p) => s + p.workHours, 0);
  const totalDrive = points.reduce((s, p) => s + p.driveFromPrevKm / 70, 0);
  const totalKm = points.reduce((s, p) => s + p.driveFromPrevKm, 0);

  return (
    <SafeAreaView style={st.container} edges={[]}>
      <MapView
        ref={mapRef}
        style={st.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={
          polylineCoords.length > 0
            ? { latitude: polylineCoords[0].latitude, longitude: polylineCoords[0].longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
            : { latitude: 57.72, longitude: 12.93, latitudeDelta: 0.5, longitudeDelta: 0.5 }
        }
        onMapReady={() => setTimeout(fitMap, 300)}
      >
        {/* Home pin */}
        {homeCoords && (
          <Marker coordinate={{ latitude: homeCoords.lat, longitude: homeCoords.lng }} pinColor="#1A3057" title="Hemort" />
        )}

        {/* Route line */}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#D4822A"
            strokeWidth={3}
            lineDashPattern={[0]}
          />
        )}

        {/* Job markers */}
        {withCoords.map((p, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            pinColor={POT_COLORS[p.potential]}
            title={`${i + 1}. ${p.name}`}
            description={`${formatDur(p.workHours)} arbete${p.driveFromPrevKm > 0 ? ` · 🚗 ${Math.round(p.driveFromPrevKm)} km` : ''}`}
          />
        ))}
      </MapView>

      {/* Bottom sheet */}
      <View style={st.sheet}>
        <Text style={st.sheetTitle}>{dateLabel}</Text>
        <View style={st.summaryRow}>
          <View style={st.summaryItem}>
            <Text style={st.summaryNum}>{formatDur(totalWork)}</Text>
            <Text style={st.summaryLbl}>Arbete</Text>
          </View>
          <View style={st.summaryDiv} />
          <View style={st.summaryItem}>
            <Text style={st.summaryNum}>{formatDur(totalDrive)}</Text>
            <Text style={st.summaryLbl}>Körtid</Text>
          </View>
          <View style={st.summaryDiv} />
          <View style={st.summaryItem}>
            <Text style={st.summaryNum}>{Math.round(totalKm)} km</Text>
            <Text style={st.summaryLbl}>Total sträcka</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.stopsRow}>
          {homeCoords && (
            <View style={st.stopChip}>
              <Text style={st.stopNum}>🏠</Text>
              <Text style={st.stopName}>Hemort</Text>
            </View>
          )}
          {points.map((p, i) => (
            <React.Fragment key={i}>
              {p.driveFromPrevKm > 0 && (
                <Text style={st.arrow}>→ {Math.round(p.driveFromPrevKm)} km →</Text>
              )}
              <View style={[st.stopChip, { borderColor: POT_COLORS[p.potential] }]}>
                <Text style={st.stopNum}>{i + 1}</Text>
                <Text style={st.stopName} numberOfLines={1}>{p.name}</Text>
                <Text style={st.stopTime}>{formatDur(p.workHours)}</Text>
              </View>
            </React.Fragment>
          ))}
        </ScrollView>

        <TouchableOpacity style={st.navBtn} onPress={openFullRoute}>
          <Text style={st.navBtnTxt}>🗺️  Öppna rutt i Kartor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  sheet: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#1A3057', marginBottom: 12, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 17, fontWeight: '700', color: '#111827' },
  summaryLbl: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  summaryDiv: { width: 1, backgroundColor: '#E5E7EB' },
  stopsRow: { marginBottom: 14 },
  stopChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 6, alignItems: 'center', minWidth: 80 },
  stopNum: { fontSize: 14, fontWeight: '800', color: '#1A3057' },
  stopName: { fontSize: 11, fontWeight: '600', color: '#374151', maxWidth: 80, textAlign: 'center', marginTop: 2 },
  stopTime: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  arrow: { fontSize: 11, color: '#9CA3AF', alignSelf: 'center', marginHorizontal: 4 },
  navBtn: { backgroundColor: '#1A3057', borderRadius: 14, padding: 15, alignItems: 'center' },
  navBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
