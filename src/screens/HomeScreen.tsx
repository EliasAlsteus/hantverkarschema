import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getClients, getJobs, getSettings } from '../storage';
import { buildSchedule, totalDayHours } from '../utils/scheduler';
import { Client, Job } from '../types';

const { height: SCREEN_H } = Dimensions.get('window');
const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const MONTHS = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
const WEEKDAYS = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag'];

function localIso(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'God natt';
  if (h < 10) return 'God morgon';
  if (h < 13) return 'God förmiddag';
  if (h < 17) return 'God eftermiddag';
  if (h < 21) return 'God kväll';
  return 'God natt';
}

function formatDur(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

type DayItem = {
  job: Job;
  client: Client;
  driveFromPrevKm: number;
  splitHours?: number;
};

export default function HomeScreen({ navigation }: any) {
  const [userName, setUserName] = useState('');
  const [todayItems, setTodayItems] = useState<DayItem[]>([]);
  const [todayLabel, setTodayLabel] = useState('');
  const [workH, setWorkH] = useState(0);
  const [driveHours, setDriveHours] = useState(0);
  const [returnKm, setReturnKm] = useState(0);
  const [mode, setMode] = useState<'today' | 'next' | 'empty'>('empty');
  const [settings, setSettings] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([clients, jobs, s]) => {
      setUserName(s.userName ?? '');
      setSettings(s);
      const sched = buildSchedule(clients, jobs, s);
      const todayStr = localIso(new Date());
      const todayDay = sched.find(d => localIso(d.date) === todayStr);
      const nextDay = sched[0] ?? null;
      const displayDay = todayDay ?? nextDay;

      if (displayDay) {
        const totals = totalDayHours(displayDay);
        const d = displayDay.date;
        setTodayLabel(`${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
        setWorkH(totals.workH);
        setDriveHours(totals.driveH);
        setReturnKm(displayDay.returnKm);
        setTodayItems(displayDay.items as DayItem[]);
        setMode(todayDay ? 'today' : 'next');
      } else {
        setMode('empty');
        setTodayItems([]);
      }
    });
  }, []));

  const today = new Date();

  const openJob = (client: Client, job: Job) => {
    navigation.navigate('JobsTab', { screen: 'JobDetail', params: { client, job } });
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" />

      {/* Background: dark top, light bottom */}
      <View style={st.bgTop} />
      <View style={st.bgBottom} />

      <SafeAreaView style={st.safe} edges={['top']}>
        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.dateStr}>
              {WEEKDAYS[today.getDay()]} {today.getDate()} {MONTHS[today.getMonth()]}
            </Text>
            <Text style={st.greetLine}>
              {greeting()}{userName ? `, ${userName}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={st.settingsBtn} onPress={() => navigation.navigate('SettingsTab')}>
            <Text style={st.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Sheet */}
        <ScrollView
          style={st.sheet}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {mode !== 'empty' ? (
            <>
              {/* Day label + meta */}
              <View style={st.sheetHeader}>
                <View style={[st.badge, mode === 'today' ? st.badgeToday : st.badgeNext]}>
                  <Text style={st.badgeTxt}>{mode === 'today' ? 'IDAG' : 'NÄSTA DAG'}</Text>
                </View>
                <Text style={st.sheetDate}>{todayLabel}</Text>
              </View>

              <View style={st.metaRow}>
                <View style={st.metaChip}>
                  <Text style={st.metaChipLabel}>ARBETE</Text>
                  <Text style={st.metaChipVal}>{formatDur(workH)}</Text>
                </View>
                <View style={st.metaChip}>
                  <Text style={st.metaChipLabel}>KÖRNING</Text>
                  <Text style={st.metaChipVal}>{formatDur(driveHours)}</Text>
                </View>
                {returnKm > 0 && (
                  <View style={st.metaChip}>
                    <Text style={st.metaChipLabel}>HEM</Text>
                    <Text style={st.metaChipVal}>{Math.round(returnKm)} km</Text>
                  </View>
                )}
              </View>

              <View style={st.divider} />

              {/* Job rows */}
              {todayItems.map((entry, i) => (
                <TouchableOpacity
                  key={i}
                  style={st.jobCard}
                  onPress={() => openJob(entry.client, entry.job)}
                  activeOpacity={0.7}
                >
                  <View style={[st.jobAccent, { backgroundColor: POT_COLORS[entry.client.potential] }]} />
                  <View style={st.jobBody}>
                    <View style={st.jobTopRow}>
                      <Text style={st.jobName}>{entry.client.name}</Text>
                      <Text style={st.jobDur}>{formatDur(entry.splitHours ?? entry.job.duration)}</Text>
                    </View>
                    {!!entry.client.location.address && (
                      <Text style={st.jobAddr} numberOfLines={1}>
                        📍 {entry.client.location.address.split(',')[0]}
                      </Text>
                    )}
                    {entry.driveFromPrevKm > 0 && (
                      <Text style={st.jobDrive}>🚗 {Math.round(entry.driveFromPrevKm)} km körning hit</Text>
                    )}
                  </View>
                  <Text style={st.jobChevron}>›</Text>
                </TouchableOpacity>
              ))}

              {/* Route CTA */}
              <TouchableOpacity
                style={st.routeBtn}
                onPress={() => {
                  const pts = todayItems
                    .filter(e => e.client.location.lat !== 0 || e.client.location.lng !== 0)
                    .map(e => ({
                      name: e.client.name,
                      address: e.client.location.address,
                      lat: e.client.location.lat,
                      lng: e.client.location.lng,
                      potential: e.client.potential,
                      driveFromPrevKm: e.driveFromPrevKm,
                      workHours: e.splitHours ?? e.job.duration,
                    }));
                  if (pts.length > 0) navigation.navigate('ScheduleTab', {
                    screen: 'RouteMap',
                    params: {
                      points: pts,
                      homeCoords: settings?.homeLat ? { lat: settings.homeLat, lng: settings.homeLng } : null,
                      dateLabel: todayLabel,
                    },
                  });
                }}
              >
                <Text style={st.routeBtnTxt}>🗺️  Visa dagsrutt</Text>
              </TouchableOpacity>

              <TouchableOpacity style={st.schemaLink} onPress={() => navigation.navigate('ScheduleTab')}>
                <Text style={st.schemaLinkTxt}>Visa hela schemat →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={st.emptyWrap}>
              <Text style={st.emptyIcon}>📋</Text>
              <Text style={st.emptyTitle}>Inga jobb planerade</Text>
              <Text style={st.emptySub}>
                Lägg till ett jobb och markera det som accepterat — appen planerar resten automatiskt.
              </Text>
              <TouchableOpacity
                style={st.emptyBtn}
                onPress={() => navigation.navigate('JobsTab', { screen: 'AddJob' })}
              >
                <Text style={st.emptyBtnTxt}>+ Lägg till jobb</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const HEADER_H = SCREEN_H * 0.28;

const st = StyleSheet.create({
  root: { flex: 1 },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H + 60, backgroundColor: '#1A3057' },
  bgBottom: { position: 'absolute', top: HEADER_H + 60, left: 0, right: 0, bottom: 0, backgroundColor: '#F0F2F6' },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  dateStr: { fontSize: 13, color: '#93C5FD', fontWeight: '500', marginBottom: 6, letterSpacing: 0.3 },
  greetLine: { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 34 },
  settingsBtn: { padding: 4, marginTop: 2 },
  settingsIcon: { fontSize: 22 },

  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeToday: { backgroundColor: '#D4822A' },
  badgeNext: { backgroundColor: '#1A3057' },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  sheetDate: { fontSize: 17, fontWeight: '700', color: '#111827' },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metaChip: { flex: 1, backgroundColor: '#F8F9FB', borderRadius: 14, padding: 14, alignItems: 'center' },
  metaChipLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 4 },
  metaChipVal: { fontSize: 15, fontWeight: '800', color: '#1A3057' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },

  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  jobAccent: { width: 5, alignSelf: 'stretch' },
  jobBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  jobName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  jobDur: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginLeft: 8 },
  jobAddr: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  jobDrive: { fontSize: 12, color: '#9CA3AF' },
  jobChevron: { fontSize: 22, color: '#D1D5DB', paddingRight: 14 },

  routeBtn: {
    marginTop: 8,
    backgroundColor: '#1A3057',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  routeBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  schemaLink: { alignItems: 'center', paddingVertical: 16 },
  schemaLinkTxt: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A3057', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBtn: {
    backgroundColor: '#D4822A',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
