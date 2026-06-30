import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { getClients, getJobs, regeoCodeAllClients, getSettings } from '../storage';
import { Client, Job } from '../types';

function formatDur(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

const PIN_COLOR = '#D4822A';
const HOME_COLOR = '#1A3057';

type Entry = { job: Job; client: Client };

export default function MapScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fixing, setFixing] = useState(false);
  const [fixMsg, setFixMsg] = useState('');
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const mapRef = useRef<MapView>(null);
  // Prevents MapView.onPress from clearing selection right after a marker tap
  const markerJustPressed = useRef(false);

  const load = useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([clients, jobs, settings]) => {
      if (settings.homeLat !== 0 || settings.homeLng !== 0) {
        setHomeCoords({ lat: settings.homeLat, lng: settings.homeLng });
      }
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const visible = jobs
        .filter(j => j.status !== 'klar' && clientMap[j.clientId])
        .map(j => ({ job: j, client: clientMap[j.clientId] }))
        .sort((a, b) => b.client.potential - a.client.potential);
      setEntries(visible);
    });
  }, []);

  useFocusEffect(load);

  const withCoords = entries.filter(e => e.client.location.lat !== 0 || e.client.location.lng !== 0);
  const noCoords = entries.filter(e => e.client.location.lat === 0 && e.client.location.lng === 0);

  const fitAll = () => {
    if (withCoords.length === 0 || !mapRef.current) return;
    const coords = withCoords.map(e => ({ latitude: e.client.location.lat, longitude: e.client.location.lng }));
    if (homeCoords) coords.push({ latitude: homeCoords.lat, longitude: homeCoords.lng });
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: selected ? 180 : 100, left: 60 }, animated: true,
    });
  };

  const fixCoords = async () => {
    setFixing(true);
    setFixMsg('Hamtar koordinater...');
    const updated = await regeoCodeAllClients((done, total) => {
      setFixMsg(`${done + 1} av ${total}...`);
    });
    setFixMsg(`${updated} uppdaterade`);
    load();
    setTimeout(() => { setFixing(false); setFixMsg(''); }, 2000);
  };

  const selectEntry = (entry: Entry) => {
    markerJustPressed.current = true;
    setSelected(entry);
    setTimeout(() => { markerJustPressed.current = false; }, 300);
  };

  const clearSelection = () => {
    if (!markerJustPressed.current) setSelected(null);
  };

  const openDetail = () => {
    if (!selected) return;
    const { client, job } = selected;
    navigation.navigate('JobsTab', {
      screen: 'JobDetail',
      params: { client, job },
    });
    setSelected(null);
  };

  const initialRegion = homeCoords
    ? { latitude: homeCoords.lat, longitude: homeCoords.lng, latitudeDelta: 0.8, longitudeDelta: 0.8 }
    : withCoords.length > 0
      ? { latitude: withCoords[0].client.location.lat, longitude: withCoords[0].client.location.lng, latitudeDelta: 0.4, longitudeDelta: 0.4 }
      : { latitude: 59.33, longitude: 18.07, latitudeDelta: 4, longitudeDelta: 4 };

  return (
    <View style={st.root}>
      {/* Header with manual top inset */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Jobbkarta</Text>
          <Text style={st.headerSub}>
            {withCoords.length > 0
              ? `${withCoords.length} jobb pa kartan${noCoords.length > 0 ? ` - ${noCoords.length} saknar adress` : ''}`
              : 'Inga jobb att visa'}
          </Text>
        </View>
        {withCoords.length > 1 && (
          <TouchableOpacity style={st.fitBtn} onPress={fitAll}>
            <Text style={st.fitBtnTxt}>Visa alla</Text>
          </TouchableOpacity>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyIcon}>{"📍"}</Text>
          <Text style={st.emptyTitle}>Inga aktiva jobb</Text>
          <Text style={st.emptySub}>Lagg till jobb med adress sa visas de har.</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            showsUserLocation={true}
            showsMyLocationButton={true}
            initialRegion={initialRegion}
            onMapReady={() => setTimeout(fitAll, 300)}
            onPress={clearSelection}
          >
            {homeCoords && (
              <Marker
                coordinate={{ latitude: homeCoords.lat, longitude: homeCoords.lng }}
                pinColor={HOME_COLOR}
                title="Hemort"
              />
            )}
            {withCoords.map(({ job, client }) => (
              <Marker
                key={job.id}
                coordinate={{ latitude: client.location.lat, longitude: client.location.lng }}
                pinColor={PIN_COLOR}
                onPress={() => selectEntry({ job, client })}
              />
            ))}
          </MapView>

          {noCoords.length > 0 && (
            <View style={st.banner}>
              {fixing ? (
                <View style={st.bannerRow}>
                  <ActivityIndicator size="small" color="#92400E" />
                  <Text style={st.bannerTxt}>{fixMsg}</Text>
                </View>
              ) : (
                <TouchableOpacity style={st.bannerRow} onPress={fixCoords}>
                  <Text style={st.bannerTxt}>
                    {noCoords.length} jobb saknar koordinater - tryck for att hamta
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Card — sibling of the map container. pointerEvents="box-none" on wrapper lets map receive taps
          while the TouchableOpacity inside still works */}
      {selected && (
        <View style={st.cardWrap} pointerEvents="box-none">
          <View style={st.card}>
            {/* Close button */}
            <TouchableOpacity style={st.closeBtn} onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={st.closeBtnTxt}>{'×'}</Text>
            </TouchableOpacity>

            {/* Info */}
            <Text style={st.cardName}>{selected.client.name}</Text>
            {selected.client.location.address.length > 0 && (
              <Text style={st.cardAddr} numberOfLines={1}>
                {selected.client.location.address.split(',').slice(0, 2).join(',')}
              </Text>
            )}
            <View style={st.cardRow}>
              <View style={st.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Text key={i} style={{ color: i <= selected.client.potential ? '#FACC15' : '#D1D5DB', fontSize: 20 }}>
                    {'★'}
                  </Text>
                ))}
              </View>
              <Text style={st.cardDur}>{formatDur(selected.job.duration)}</Text>
            </View>

            {/* Full-width detail button */}
            <TouchableOpacity style={st.detailBtn} onPress={openDetail} activeOpacity={0.85}>
              <Text style={st.detailBtnTxt}>Visa detaljer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F4F7' },
  header: {
    backgroundColor: '#1A3057',
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  fitBtn: {
    backgroundColor: '#D4822A', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginLeft: 12, marginBottom: 2,
  },
  fitBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A3057', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 36, lineHeight: 20 },
  banner: {
    position: 'absolute', top: 12, left: 16, right: 16,
    backgroundColor: '#FEF3C7', borderRadius: 12,
    borderWidth: 1, borderColor: '#FDE68A', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTxt: { fontSize: 12, color: '#92400E', fontWeight: '600', flex: 1 },
  cardWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 14,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnTxt: { fontSize: 18, color: '#6B7280', lineHeight: 22, fontWeight: '600' },
  cardName: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4, paddingRight: 36 },
  cardAddr: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  starsRow: { flexDirection: 'row', gap: 2 },
  cardDur: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  detailBtn: {
    backgroundColor: '#1A3057', borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
  },
  detailBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
