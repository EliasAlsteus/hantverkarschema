import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getClients, getJobs, getSettings } from '../storage';
import { Client, Job, JobStatus } from '../types';

const STATUS_COLOR: Record<JobStatus, string> = {
  accepterad: '#EAB308',
  offert:     '#3B82F6',
  förfrågan:  '#8B5CF6',
  klar:       '#22C55E',
};
const STATUS_LABEL: Record<JobStatus, string> = {
  accepterad: 'Accepterad',
  offert:     'Offert',
  förfrågan:  'Förfrågan',
  klar:       'Klar',
};
const STATUS_PRIORITY: JobStatus[] = ['accepterad', 'offert', 'förfrågan', 'klar'];
const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function getBestJob(jobs: Job[]): Job | null {
  for (const s of STATUS_PRIORITY) {
    const j = jobs.find(x => x.status === s);
    if (j) return j;
  }
  return jobs[0] ?? null;
}

function pinIcon(color: string, size = 18): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function homeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:#1A3057;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;line-height:16px;text-align:center">🏠</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

type Entry = { client: Client; job: Job };

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 12);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
    }
  }, []);
  return null;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [homeLat, setHomeLat] = useState(0);
  const [homeLng, setHomeLng] = useState(0);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Fix Leaflet default icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Inject Leaflet CSS
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      link.onload = () => setReady(true);
      document.head.appendChild(link);
    } else {
      setReady(true);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([clients, jobs, s]) => {
      setHomeLat(s.homeLat ?? 0);
      setHomeLng(s.homeLng ?? 0);
      const result: Entry[] = [];
      for (const client of clients) {
        if (client.location.lat === 0 && client.location.lng === 0) continue;
        const clientJobs = jobs.filter(j => j.clientId === client.id);
        if (!clientJobs.length) continue;
        const job = getBestJob(clientJobs);
        if (job) result.push({ client, job });
      }
      setEntries(result);
    });
  }, []));

  const allPoints: [number, number][] = [
    ...entries.map(e => [e.client.location.lat, e.client.location.lng] as [number, number]),
    ...(homeLat !== 0 ? [[homeLat, homeLng] as [number, number]] : []),
  ];

  const navigate = (e: Entry) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${e.client.location.lat},${e.client.location.lng}`;
    Linking.openURL(url);
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Text style={st.title}>Jobbkarta</Text>
        <Text style={st.sub}>{entries.length} jobb · tryck på markör</Text>
      </View>

      {!ready ? (
        <View style={st.loader}>
          <ActivityIndicator color="#1A3057" size="large" />
          <Text style={st.loaderTxt}>Laddar karta…</Text>
        </View>
      ) : (
        <View style={st.mapWrap}>
          <MapContainer
            center={[59.5, 15.5]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            {allPoints.length > 0 && <FitBounds points={allPoints} />}

            {homeLat !== 0 && (
              <Marker
                position={[homeLat, homeLng]}
                icon={homeIcon()}
                eventHandlers={{ click: () => setSelected(null) }}
              />
            )}

            {entries.map((entry, i) => (
              <Marker
                key={i}
                position={[entry.client.location.lat, entry.client.location.lng]}
                icon={pinIcon(STATUS_COLOR[entry.job.status])}
                eventHandlers={{ click: () => setSelected(entry) }}
              />
            ))}
          </MapContainer>

          {/* Legend */}
          <View style={st.legend} pointerEvents="none">
            {(Object.keys(STATUS_COLOR) as JobStatus[]).map(s => (
              <View key={s} style={st.legendRow}>
                <View style={[st.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={st.legendTxt}>{STATUS_LABEL[s]}</Text>
              </View>
            ))}
            <View style={st.legendRow}>
              <View style={[st.legendDot, { backgroundColor: '#1A3057' }]} />
              <Text style={st.legendTxt}>Hemort</Text>
            </View>
          </View>

          {/* Selected card */}
          {selected && (
            <View style={st.card} pointerEvents="box-none">
              <TouchableOpacity style={st.closeBtn} onPress={() => setSelected(null)}>
                <Text style={st.closeTxt}>✕</Text>
              </TouchableOpacity>

              <View style={st.cardTop}>
                <View style={[st.potDot, { backgroundColor: POT_COLORS[selected.client.potential] ?? '#ccc' }]} />
                <Text style={st.cardName}>{selected.client.name}</Text>
              </View>
              <Text style={st.cardAddr}>{selected.client.location.address}</Text>

              <View style={st.cardRow}>
                <View style={[st.badge, { backgroundColor: STATUS_COLOR[selected.job.status] + '22' }]}>
                  <Text style={[st.badgeTxt, { color: STATUS_COLOR[selected.job.status] }]}>
                    ● {STATUS_LABEL[selected.job.status]}
                  </Text>
                </View>
                <Text style={st.stars}>{'★'.repeat(selected.client.potential)}</Text>
              </View>

              <TouchableOpacity style={st.navBtn} onPress={() => navigate(selected)}>
                <Text style={st.navTxt}>Navigera dit  ↗</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F2F4F7' },
  header:     { backgroundColor: '#1A3057', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontSize: 20, fontWeight: '700', color: '#fff' },
  sub:        { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  loader:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt:  { color: '#6B7280', fontSize: 15 },
  mapWrap:    { flex: 1, position: 'relative' },

  legend:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 10, gap: 5 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: 11, color: '#374151', fontWeight: '500' },

  card:       { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  closeBtn:   { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 12, color: '#6B7280' },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginRight: 36 },
  potDot:     { width: 10, height: 10, borderRadius: 5 },
  cardName:   { fontSize: 16, fontWeight: '700', color: '#1A3057', flex: 1 },
  cardAddr:   { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  cardRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badge:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:   { fontSize: 13, fontWeight: '600' },
  stars:      { color: '#EAB308', fontSize: 14, letterSpacing: 1 },
  navBtn:     { backgroundColor: '#D4822A', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  navTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },
});
