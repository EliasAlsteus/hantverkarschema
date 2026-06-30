import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getClients, getJobs, getSettings } from '../storage';
import { haversineKm } from '../utils/scheduler';
import { Client, Job, JobStatus } from '../types';

// Status → accent colour on the card left bar
const STATUS_COLOR: Record<JobStatus, string> = {
  förfrågan:  '#8B5CF6',  // purple
  offert:     '#3B82F6',  // blue
  accepterad: '#EAB308',  // yellow
  klar:       '#22C55E',  // green
};

const STATUS_META: Record<JobStatus, { label: string; color: string; bg: string }> = {
  förfrågan:  { label: 'Förfrågan',  color: '#7C3AED', bg: '#F5F3FF' },
  offert:     { label: 'Offert',     color: '#3B82F6', bg: '#EFF6FF' },
  accepterad: { label: 'Accepterad', color: '#CA8A04', bg: '#FEF9C3' },
  klar:       { label: 'Klar ✓',    color: '#16A34A', bg: '#DCFCE7' },
};

type Tab = 'förfrågan' | 'offert' | 'accepterad' | 'klar';
type SortKey = 'potential' | 'duration' | 'distance' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'potential', label: 'Potential',   icon: '★' },
  { key: 'duration',  label: 'Tidsåtgång', icon: '⏱' },
  { key: 'distance',  label: 'Avstånd',    icon: '📍' },
  { key: 'name',      label: 'Namn (A–Ö)', icon: 'Aa' },
];

function formatDuration(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs} tim ${mins} min`;
}

export default function JobsScreen({ navigation }: any) {
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<Tab>('förfrågan');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('potential');
  const [sortOpen, setSortOpen] = useState(false);
  const [homeLat, setHomeLat] = useState(0);
  const [homeLng, setHomeLng] = useState(0);

  useFocusEffect(useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([c, j, s]) => {
      setClients(c);
      setJobs(j);
      setHomeLat(s.homeLat);
      setHomeLng(s.homeLng);
    });
  }, []));

  const clientJobs = (id: string) => jobs.filter(j => j.clientId === id);
  const leadCount     = jobs.filter(j => j.status === 'förfrågan').length;
  const offerCount    = jobs.filter(j => j.status === 'offert').length;
  const acceptedCount = jobs.filter(j => j.status === 'accepterad').length;
  const doneCount     = jobs.filter(j => j.status === 'klar').length;

  const clientsForTab = clients.filter(c => clientJobs(c.id).some(j => j.status === tab));

  const searched = search.trim()
    ? clientsForTab.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.location.address.toLowerCase().includes(search.toLowerCase())
      )
    : clientsForTab;

  const homeHasCoords = homeLat !== 0 || homeLng !== 0;

  const sorted = [...searched].sort((a, b) => {
    if (sortKey === 'potential') return b.potential - a.potential;
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'sv');
    if (sortKey === 'duration') {
      const aH = clientJobs(a.id).filter(j => j.status === tab).reduce((s, j) => s + j.duration, 0);
      const bH = clientJobs(b.id).filter(j => j.status === tab).reduce((s, j) => s + j.duration, 0);
      return bH - aH;
    }
    if (sortKey === 'distance') {
      if (!homeHasCoords) return 0;
      const aDist = a.location.lat !== 0
        ? haversineKm(homeLat, homeLng, a.location.lat, a.location.lng) : 9999;
      const bDist = b.location.lat !== 0
        ? haversineKm(homeLat, homeLng, b.location.lat, b.location.lng) : 9999;
      return aDist - bDist;
    }
    return 0;
  });

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'förfrågan',  label: 'Förfrågan', count: leadCount },
    { key: 'offert',     label: 'Offerter',  count: offerCount },
    { key: 'accepterad', label: 'Aktiva',     count: acceptedCount },
    { key: 'klar',       label: 'Klara',      count: doneCount },
  ];

  const curSort = SORT_OPTIONS.find(o => o.key === sortKey)!;

  return (
    <SafeAreaView style={st.container} edges={[]}>
      {/* Stats bar */}
      <View style={st.statsRow}>
        <View style={st.statBox}>
          <Text style={st.statNum}>{clients.length}</Text>
          <Text style={st.statLbl}>Kunder</Text>
        </View>
        <View style={st.statDiv} />
        <View style={st.statBox}>
          <Text style={st.statNum}>{acceptedCount}</Text>
          <Text style={st.statLbl}>Schemaläggs</Text>
        </View>
        <View style={st.statDiv} />
        <View style={st.statBox}>
          <Text style={st.statNum}>{formatDuration(jobs.filter(j=>j.status==='accepterad').reduce((s,j)=>s+j.duration,0))}</Text>
          <Text style={st.statLbl}>Kvar</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[st.tabBtn, tab === t.key && st.tabBtnOn]}
            onPress={() => setTab(t.key)}>
            <View style={[st.tabDot, { backgroundColor: STATUS_COLOR[t.key] }]} />
            <Text style={[st.tabTxt, tab === t.key && st.tabTxtOn]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Sort row */}
      <View style={st.toolRow}>
        <View style={st.searchBox}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            style={st.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Sök kund eller adress…"
            placeholderTextColor="#9CA3AF"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity style={st.sortBtn} onPress={() => setSortOpen(true)}>
          <Text style={st.sortBtnIcon}>{curSort.icon}</Text>
          <Text style={st.sortBtnTxt}>{curSort.label}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={st.emptyBox}>
            <Text style={st.emptyIcon}>{tab === 'klar' ? '✅' : tab === 'offert' ? '📋' : '🔨'}</Text>
            <Text style={st.emptyTitle}>
              {search ? 'Inga träffar'
                : tab === 'förfrågan' ? 'Inga förfrågningar'
                : tab === 'offert' ? 'Inga offerter'
                : tab === 'accepterad' ? 'Inga aktiva jobb'
                : 'Inga klara jobb'}
            </Text>
            <Text style={st.emptySub}>
              {search ? `Inga kunder matchar "${search}"`
                : tab === 'förfrågan' ? 'Lägg till en kund direkt när de hör av sig.'
                : tab === 'offert' ? 'Skicka en offert via "+ Nytt jobb".'
                : tab === 'accepterad' ? 'Acceptera en offert för att schemalägga den.'
                : 'Markera jobb som klara i jobbdetaljerna.'}
            </Text>
          </View>
        }
        renderItem={({ item: client }) => {
          const cJobs = clientJobs(client.id).filter(j => j.status === tab);
          const allPhotos = clientJobs(client.id).flatMap(j => j.photos ?? []);
          const totalH = cJobs.reduce((s, j) => s + j.duration, 0);
          const firstJob = cJobs[0] ?? clientJobs(client.id)[0];

          const accentColor = STATUS_COLOR[tab];

          const distKm = homeHasCoords && client.location.lat !== 0
            ? haversineKm(homeLat, homeLng, client.location.lat, client.location.lng)
            : null;

          return (
            <TouchableOpacity
              style={st.card}
              onPress={() => firstJob && navigation.navigate('JobDetail', { client, job: firstJob })}
              activeOpacity={0.82}
            >
              <View style={[st.potBar, { backgroundColor: accentColor }]} />
              <View style={st.cardBody}>
                <View style={st.cardTop}>
                  <Text style={st.clientName}>{client.name}</Text>
                  <View style={st.starsRow}>
                    {[1,2,3,4,5].map(n => (
                      <Text key={n} style={[st.star, { color: n <= client.potential ? '#FACC15' : '#E5E7EB' }]}>★</Text>
                    ))}
                  </View>
                </View>

                {!!client.location.address && (
                  <Text style={st.address} numberOfLines={1}>
                    📍 {client.location.address.split(',')[0]}
                    {distKm !== null ? `  ·  ${Math.round(distKm)} km` : ''}
                  </Text>
                )}

                {allPhotos.length > 0 && (
                  <View style={st.thumbRow}>
                    {allPhotos.slice(0, 4).map((uri, i) => (
                      <Image key={i} source={{ uri }} style={st.thumb} />
                    ))}
                    {allPhotos.length > 4 && (
                      <View style={[st.thumb, st.thumbMore]}>
                        <Text style={st.thumbMoreTxt}>+{allPhotos.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={st.cardBottom}>
                  <Text style={st.meta}>{cJobs.length} jobb · {formatDuration(totalH)}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {cJobs.slice(0, 3).map((job, i) => {
                      const m = STATUS_META[job.status];
                      return (
                        <View key={i} style={[st.statusTag, { backgroundColor: m.bg }]}>
                          <Text style={[st.statusTagTxt, { color: m.color }]}>{m.label}</Text>
                        </View>
                      );
                    })}
                    <Text style={st.chevron}>›</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={st.fab} onPress={() => navigation.navigate('AddJob')}>
        <Text style={st.fabTxt}>+ Nytt jobb</Text>
      </TouchableOpacity>

      {/* Sort modal */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setSortOpen(false)}>
          <View style={st.sortSheet}>
            <Text style={st.sortSheetTitle}>Sortera efter</Text>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[st.sortOption, sortKey === opt.key && st.sortOptionOn]}
                onPress={() => { setSortKey(opt.key); setSortOpen(false); }}
              >
                <Text style={st.sortOptionIcon}>{opt.icon}</Text>
                <Text style={[st.sortOptionTxt, sortKey === opt.key && { color: '#D4822A', fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {sortKey === opt.key && <Text style={st.sortCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  statsRow: { flexDirection: 'row', backgroundColor: '#1A3057', paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#fff' },
  statLbl: { fontSize: 10, color: '#93C5FD', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDiv: { width: 1, height: 36, backgroundColor: '#2D4A6E' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  tabBtnOn: { borderBottomColor: '#D4822A' },
  tabDot: { width: 8, height: 8, borderRadius: 4 },
  tabTxt: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tabTxtOn: { color: '#D4822A' },
  toolRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 2 },
  searchIcon: { fontSize: 15, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 10 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10 },
  sortBtnIcon: { fontSize: 13 },
  sortBtnTxt: { fontSize: 12, fontWeight: '700', color: '#374151' },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A3057', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 36, lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  potBar: { width: 5 },
  cardBody: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 14 },
  address: { fontSize: 12, color: '#6B7280', marginBottom: 7 },
  thumbRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  thumb: { width: 48, height: 48, borderRadius: 7 },
  thumbMore: { backgroundColor: '#1A3057', justifyContent: 'center', alignItems: 'center' },
  thumbMoreTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 12, color: '#9CA3AF' },
  statusTag: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusTagTxt: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 20, color: '#D1D5DB' },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#D4822A', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 14, shadowColor: '#D4822A', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sortSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sortSheetTitle: { fontSize: 16, fontWeight: '800', color: '#1A3057', marginBottom: 16 },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sortOptionOn: { },
  sortOptionIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  sortOptionTxt: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '600' },
  sortCheck: { fontSize: 16, color: '#D4822A', fontWeight: '700' },
});
