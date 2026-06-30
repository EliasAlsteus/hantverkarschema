import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getClients, getJobs, getSettings } from '../storage';
import { Client, Job, JobStatus } from '../types';
import { buildSchedule, totalDayHours, ScheduleDay } from '../utils/scheduler';

const WEEKDAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const MONTHS   = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const STATUS_COLOR: Record<JobStatus, string> = {
  accepterad: '#EAB308', offert: '#3B82F6', förfrågan: '#8B5CF6', klar: '#22C55E',
};

function formatDur(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

function dayLabel(d: Date) {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Numbered job marker
function jobIcon(num: number, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;line-height:26px;text-align:center">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function homeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:#1A3057;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:18px;text-align:center">🏠</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function bgIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);opacity:0.45"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 1) map.setView(coords[0], 12);
    else if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 14 });
  }, [coords.map(c => c.join()).join('|')]);
  return null;
}

type BgEntry = { client: Client; job: Job };

function getBestStatus(jobs: Job[]): JobStatus {
  for (const s of ['accepterad','offert','förfrågan','klar'] as JobStatus[]) {
    if (jobs.find(j => j.status === s)) return s;
  }
  return 'förfrågan';
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [days, setDays]           = useState<ScheduleDay[]>([]);
  const [bgEntries, setBgEntries] = useState<BgEntry[]>([]);
  const [homeLat, setHomeLat]     = useState(0);
  const [homeLng, setHomeLng]     = useState(0);
  const [dayIdx, setDayIdx]       = useState(0);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      link.onload = () => setReady(true);
      document.head.appendChild(link);
    } else {
      setReady(true);
    }
    // Ensure leaflet container fills parent properly
    if (!document.querySelector('style[data-leaflet-fix]')) {
      const s = document.createElement('style');
      s.setAttribute('data-leaflet-fix', '1');
      s.textContent = '.leaflet-container { height: 100% !important; width: 100% !important; }';
      document.head.appendChild(s);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([clients, jobs, s]) => {
      setHomeLat(s.homeLat ?? 0);
      setHomeLng(s.homeLng ?? 0);

      const schedule = buildSchedule(clients, jobs, s);
      setDays(schedule);
      setDayIdx(0);

      // Background: all clients with coords
      const scheduledJobIds = new Set(schedule.flatMap(d => d.items.map(i => i.job.id)));
      const bg: BgEntry[] = [];
      for (const client of clients) {
        if (client.location.lat === 0 && client.location.lng === 0) continue;
        const clientJobs = jobs.filter(j => j.clientId === client.id && !scheduledJobIds.has(j.id));
        if (!clientJobs.length) continue;
        const job = clientJobs.find(j => j.status === 'offert') ??
                    clientJobs.find(j => j.status === 'förfrågan') ??
                    clientJobs[0];
        bg.push({ client, job });
      }
      setBgEntries(bg);
    });
  }, []));

  const currentDay = days[dayIdx] ?? null;
  const { workH, driveH: driveHours } = currentDay ? totalDayHours(currentDay) : { workH: 0, driveH: 0 };
  const totalKm = currentDay ? currentDay.items.reduce((s, e) => s + e.driveFromPrevKm, 0) + currentDay.returnKm : 0;

  // Polyline coords: home → jobs in order
  const polyline: [number, number][] = [];
  if (homeLat !== 0 && currentDay) polyline.push([homeLat, homeLng]);
  if (currentDay) {
    for (const item of currentDay.items) {
      const { lat, lng } = item.client.location;
      if (lat !== 0 || lng !== 0) polyline.push([lat, lng]);
    }
  }
  if (homeLat !== 0 && polyline.length > 1) polyline.push([homeLat, homeLng]);

  const allBgCoords: [number, number][] = bgEntries.map(e => [e.client.location.lat, e.client.location.lng]);
  const fitCoords: [number, number][] = polyline.length > 0
    ? polyline
    : allBgCoords.length > 0
      ? allBgCoords
      : (homeLat !== 0 ? [[homeLat, homeLng]] : []);

  const openGoogleMaps = () => {
    if (!currentDay) return;
    const stops = currentDay.items
      .filter(e => e.client.location.lat !== 0)
      .map(e => encodeURIComponent(e.client.location.address));
    const origin = homeLat !== 0 ? `${homeLat},${homeLng}` : stops[0];
    const url = `https://www.google.com/maps/dir/${origin}/${stops.join('/')}`;
    Linking.openURL(url);
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>

      {/* Header + day nav */}
      <View style={st.header}>
        <Text style={st.title}>Jobbkarta</Text>
        {days.length > 0 && (
          <View style={st.dayNav}>
            <TouchableOpacity
              style={[st.navArrow, dayIdx === 0 && st.navArrowDisabled]}
              onPress={() => setDayIdx(i => Math.max(0, i - 1))}
              disabled={dayIdx === 0}>
              <Text style={st.navArrowTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={st.dayLbl} numberOfLines={1}>
              {currentDay ? dayLabel(currentDay.date) : '—'}
            </Text>
            <TouchableOpacity
              style={[st.navArrow, dayIdx === days.length - 1 && st.navArrowDisabled]}
              onPress={() => setDayIdx(i => Math.min(days.length - 1, i + 1))}
              disabled={dayIdx === days.length - 1}>
              <Text style={st.navArrowTxt}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!ready ? (
        <View style={st.loader}>
          <ActivityIndicator color="#1A3057" size="large" />
          <Text style={st.loaderTxt}>Laddar karta…</Text>
        </View>
      ) : (
        <>
          {/* Map — explicit pixel height so Leaflet can resolve 100% */}
          <View style={[st.mapWrap, { height: Dimensions.get('window').height - insets.top - 120 - (days.length > 0 ? 180 : 50) }]}>
            <MapContainer center={[59.5, 15.5]} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              />

              {fitCoords.length > 0 && <FitBounds coords={fitCoords} />}

              {/* Background jobs (other statuses) */}
              {bgEntries.map((e, i) => (
                <Marker key={`bg-${i}`}
                  position={[e.client.location.lat, e.client.location.lng]}
                  icon={bgIcon(STATUS_COLOR[e.job.status])} />
              ))}

              {/* Home */}
              {homeLat !== 0 && <Marker position={[homeLat, homeLng]} icon={homeIcon()} />}

              {/* Route polyline */}
              {polyline.length > 1 && (
                <Polyline positions={polyline} color="#D4822A" weight={3.5} dashArray="8 4" opacity={0.9} />
              )}

              {/* Day job markers */}
              {currentDay && currentDay.items.map((item, i) => {
                const { lat, lng } = item.client.location;
                if (lat === 0 && lng === 0) return null;
                return (
                  <Marker key={`job-${i}`}
                    position={[lat, lng]}
                    icon={jobIcon(i + 1, POT_COLORS[item.client.potential] ?? '#1A3057')} />
                );
              })}
            </MapContainer>
          </View>

          {/* Bottom panel */}
          {days.length === 0 ? (
            <View style={st.emptyPanel}>
              <Text style={st.emptyTxt}>Inga schemalagda jobb — lägg till jobb med status Accepterad.</Text>
            </View>
          ) : (
            <View style={st.panel}>
              {/* Stats row */}
              <View style={st.statsRow}>
                <View style={st.statBox}>
                  <Text style={st.statNum}>{formatDur(workH)}</Text>
                  <Text style={st.statLbl}>Arbete</Text>
                </View>
                <View style={st.statDiv} />
                <View style={st.statBox}>
                  <Text style={st.statNum}>{formatDur(driveHours)}</Text>
                  <Text style={st.statLbl}>Körtid</Text>
                </View>
                <View style={st.statDiv} />
                <View style={st.statBox}>
                  <Text style={st.statNum}>{Math.round(totalKm)} km</Text>
                  <Text style={st.statLbl}>Sträcka</Text>
                </View>
                <View style={st.statDiv} />
                <View style={st.statBox}>
                  <Text style={st.statNum}>{currentDay?.items.length ?? 0}</Text>
                  <Text style={st.statLbl}>Jobb</Text>
                </View>
              </View>

              {/* Stop list */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.stopsScroll} contentContainerStyle={st.stopsContent}>
                {homeLat !== 0 && (
                  <View style={st.chip}>
                    <Text style={st.chipNum}>🏠</Text>
                    <Text style={st.chipName}>Hemort</Text>
                  </View>
                )}
                {currentDay?.items.map((item, i) => (
                  <React.Fragment key={i}>
                    {item.driveFromPrevKm > 0 && (
                      <Text style={st.arrow}>→ {Math.round(item.driveFromPrevKm)} km</Text>
                    )}
                    <View style={[st.chip, { borderColor: POT_COLORS[item.client.potential] ?? '#E5E7EB' }]}>
                      <Text style={st.chipNum}>{i + 1}</Text>
                      <Text style={st.chipName} numberOfLines={1}>{item.client.name}</Text>
                      <Text style={st.chipTime}>{formatDur(item.splitHours ?? item.job.duration)}</Text>
                    </View>
                  </React.Fragment>
                ))}
                {homeLat !== 0 && currentDay && currentDay.returnKm > 0 && (
                  <>
                    <Text style={st.arrow}>→ {Math.round(currentDay.returnKm)} km</Text>
                    <View style={st.chip}>
                      <Text style={st.chipNum}>🏠</Text>
                      <Text style={st.chipName}>Hemort</Text>
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Navigate button */}
              <TouchableOpacity style={st.navBtn} onPress={openGoogleMaps}>
                <Text style={st.navBtnTxt}>Öppna rutt i Google Maps  ↗</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F2F4F7' },

  header:     { backgroundColor: '#1A3057', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  title:      { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  dayNav:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navArrow:   { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navArrowDisabled: { opacity: 0.3 },
  navArrowTxt:{ color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  dayLbl:     { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },

  loader:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt:  { color: '#6B7280', fontSize: 15 },

  mapWrap:    { flex: 1 },

  emptyPanel: { backgroundColor: '#fff', padding: 20, alignItems: 'center' },
  emptyTxt:   { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },

  panel:      { backgroundColor: '#fff', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },

  statsRow:   { flexDirection: 'row', marginBottom: 12 },
  statBox:    { flex: 1, alignItems: 'center' },
  statNum:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  statLbl:    { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  statDiv:    { width: 1, backgroundColor: '#E5E7EB' },

  stopsScroll:  { marginBottom: 12 },
  stopsContent: { paddingRight: 16, alignItems: 'center' },
  chip:       { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginRight: 4, alignItems: 'center', minWidth: 72 },
  chipNum:    { fontSize: 13, fontWeight: '800', color: '#1A3057' },
  chipName:   { fontSize: 10, fontWeight: '600', color: '#374151', maxWidth: 72, textAlign: 'center', marginTop: 2 },
  chipTime:   { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  arrow:      { fontSize: 10, color: '#9CA3AF', alignSelf: 'center', marginHorizontal: 4 },

  navBtn:     { backgroundColor: '#1A3057', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  navBtnTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
});
