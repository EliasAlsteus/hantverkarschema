import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getClients, getJobs, updateJob, getSettings, AppSettings } from '../storage';
import { Client, Job } from '../types';
import { buildSchedule, ScheduleDay, ScheduleEntry, totalDayHours } from '../utils/scheduler';

const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const WEEKDAYS_FULL = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const WEEKDAYS_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

function formatDur(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} tim`;
  return `${hrs}t ${mins}m`;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function upcomingWeekdays(n: number): Date[] {
  const out: Date[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let i = 0;
  while (out.length < n) {
    const d = new Date(today); d.setDate(today.getDate() + i++);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d);
  }
  return out;
}

export default function ScheduleScreen({ navigation }: any) {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [unscheduled, setUnscheduled] = useState<{ job: Job; client: Client }[]>([]);
  const [overdue, setOverdue] = useState<{ job: Job; client: Client }[]>([]);
  const [stats, setStats] = useState({ pending: 0, hours: 0, days: 0 });
  const [moveTarget, setMoveTarget] = useState<{ job: Job; client: Client } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const weekdays = upcomingWeekdays(21);

  const reload = useCallback(() => {
    Promise.all([getClients(), getJobs(), getSettings()]).then(([clients, jobs, settings]) => {
      setSettings(settings);
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const sched = buildSchedule(clients, jobs, settings);
      const scheduledIds = new Set(sched.flatMap(d => d.items.map(e => e.job.id)));
      const todayStr = isoDate(new Date());
      const active = jobs
        .filter(j => j.status === 'accepterad')
        .map(j => ({ job: j, client: clientMap[j.clientId] }))
        .filter(x => x.client);
      const unsched = active.filter(x => !scheduledIds.has(x.job.id));
      // Jobs that had a manual pin to a past date — scheduler auto-rescheduled them
      const od = active.filter(x => x.job.manualDate && x.job.manualDate < todayStr);
      const activeHours = active.reduce((s, x) => s + x.job.duration, 0);
      setSchedule(sched);
      setUnscheduled(unsched);
      setOverdue(od);
      setStats({ pending: active.length, hours: activeHours, days: sched.length });
    });
  }, []);

  useFocusEffect(reload);

  const pinToDate = async (job: Job, date: Date | null) => {
    if (date) {
      // Check if the target day will exceed 8 hours and warn — but always allow
      const targetKey = isoDate(date);
      const targetDay = schedule.find(d => isoDate(d.date) === targetKey);
      const { totalH } = targetDay ? totalDayHours(targetDay) : { totalH: 0 };
      const newTotal = totalH + job.duration;
      if (newTotal > 8) {
        Alert.alert(
          '⚠️ Lång dag',
          `Denna dag blir ${Math.round(newTotal * 10) / 10} timmar totalt. Vill du lägga till jobbet ändå?`,
          [
            { text: 'Avbryt', style: 'cancel', onPress: () => setMoveTarget(null) },
            {
              text: 'Lägg till ändå', onPress: async () => {
                await updateJob({ ...job, manualDate: isoDate(date) });
                setMoveTarget(null);
                reload();
              }
            },
          ]
        );
        return;
      }
    }
    await updateJob({ ...job, manualDate: date ? isoDate(date) : undefined });
    setMoveTarget(null);
    reload();
  };

  const removeFromDay = (entry: ScheduleEntry) => {
    if (entry.job.locked) {
      Alert.alert(
        'Fäst datum',
        `"${entry.client.name}" är fäst till detta datum. Frigör det för att flytta.`,
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Frigör och flytta', onPress: async () => {
              await updateJob({ ...entry.job, locked: false });
              setMoveTarget({ job: { ...entry.job, locked: false }, client: entry.client });
            }
          },
        ]
      );
      return;
    }
    setMoveTarget({ job: entry.job, client: entry.client });
  };

  const toggleLock = async (entry: ScheduleEntry) => {
    if (entry.job.locked) {
      // Currently locked — release
      await updateJob({ ...entry.job, locked: false });
      reload();
    } else {
      // Not locked — pin + lock to current scheduled date
      const dayEntry = schedule.find(d => d.items.some(e => e.job.id === entry.job.id));
      const dateStr = dayEntry ? isoDate(dayEntry.date) : entry.job.manualDate;
      if (!dateStr) return;
      Alert.alert(
        'Fäst datum',
        `"${entry.client.name}" fästs till ${dateStr}. Appen kommer inte flytta det automatiskt.`,
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Fäst', onPress: async () => {
              await updateJob({ ...entry.job, manualDate: dateStr, locked: true });
              reload();
            }
          },
        ]
      );
    }
  };

  const totalScheduledHours = schedule.reduce(
    (s, d) => s + d.items.reduce((s2, e) => s2 + (e.splitHours ?? e.job.duration), 0), 0
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Väntande</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{formatDur(stats.hours)}</Text>
            <Text style={styles.statLbl}>Totalt</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{stats.days}</Text>
            <Text style={styles.statLbl}>Planerade dagar</Text>
          </View>
        </View>

        {/* Overdue / rescheduled jobs notice */}
        {overdue.length > 0 && (
          <View style={styles.overdueBox}>
            <Text style={styles.overdueTitle}>🔄 {overdue.length} jobb omplanerade</Text>
            <Text style={styles.overdueSub}>
              Dessa jobb hade ett passerat datum och har automatiskt lagts om i schemat:
            </Text>
            {overdue.map(({ job, client }) => (
              <View key={job.id} style={styles.overdueRow}>
                <View style={[styles.dot, { backgroundColor: POT_COLORS[client.potential] }]} />
                <Text style={styles.overdueName}>{client.name}</Text>
                <TouchableOpacity onPress={() => setMoveTarget({ job, client })}>
                  <Text style={styles.overduePin}>Välj datum →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Today widget */}
        {(() => {
          const todayStr = isoDate(new Date());
          const todayDay = schedule.find(d => isoDate(d.date) === todayStr);
          const nextDay = schedule[0];
          const showDay = todayDay ?? null;
          const isToday = !!todayDay;
          if (!showDay && !nextDay) return null;
          const displayDay = showDay ?? nextDay;
          const { workH, driveH: todayDriveH } = totalDayHours(displayDay);
          const label = `${WEEKDAYS_FULL[displayDay.date.getDay()]} ${displayDay.date.getDate()} ${MONTHS[displayDay.date.getMonth()]}`;
          return (
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayPill}>{isToday ? 'IDAG' : 'NÄSTA DAG'}</Text>
                <Text style={styles.todayDate}>{label}</Text>
              </View>
              {displayDay.items.map((entry, i) => (
                <View key={i} style={styles.todayRow}>
                  <View style={[styles.todayDot, { backgroundColor: POT_COLORS[entry.client.potential] }]} />
                  <Text style={styles.todayName}>{entry.client.name}</Text>
                  <Text style={styles.todayTime}>{formatDur(entry.splitHours ?? entry.job.duration)}</Text>
                  {entry.driveFromPrevKm > 0 && (
                    <Text style={styles.todayDrive}>🚗 {Math.round(entry.driveFromPrevKm)} km</Text>
                  )}
                </View>
              ))}
              <View style={styles.todayFooter}>
                <Text style={styles.todayFooterTxt}>{formatDur(workH)} arbete · {formatDur(todayDriveH)} körning</Text>
                <TouchableOpacity onPress={() => {
                  const pts = displayDay.items
                    .filter(e => e.client.location.lat !== 0 || e.client.location.lng !== 0)
                    .map(e => ({
                      name: e.client.name, address: e.client.location.address,
                      lat: e.client.location.lat, lng: e.client.location.lng,
                      potential: e.client.potential, driveFromPrevKm: e.driveFromPrevKm,
                      workHours: e.splitHours ?? e.job.duration,
                    }));
                  if (pts.length > 0) navigation.navigate('RouteMap', {
                    points: pts,
                    homeCoords: settings?.homeLat ? { lat: settings.homeLat, lng: settings.homeLng } : null,
                    dateLabel: label,
                  });
                }}>
                  <Text style={styles.todayMapLink}>🗺️ Visa rutt</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Unscheduled overflow */}
        {unscheduled.length > 0 && (
          <View style={styles.unschedBox}>
            <Text style={styles.unschedTitle}>⚠️ {unscheduled.length} jobb kunde inte schemaläggas</Text>
            {unscheduled.map(({ job, client }) => (
              <TouchableOpacity key={job.id} style={styles.unschedRow}
                onPress={() => setMoveTarget({ job, client })}>
                <View style={[styles.dot, { backgroundColor: POT_COLORS[client.potential] }]} />
                <Text style={styles.unschedName}>{client.name} · {formatDur(job.duration)}</Text>
                <Text style={styles.unschedPin}>Välj datum →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {schedule.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Inget att planera</Text>
            <Text style={styles.emptySub}>Lägg till jobb på Jobb-fliken. Schemat byggs automatiskt och tar hänsyn till plats och kundvärde.</Text>
          </View>
        ) : (
          schedule.map((day, i) => {
            const { workH, driveH: driveHours, totalH: dayHours } = totalDayHours(day);
            const fill = Math.min(dayHours, 8) / 8;
            const isLong = dayHours > 8;
            const dayLabel = `${WEEKDAYS_FULL[day.date.getDay()]} ${day.date.getDate()} ${MONTHS[day.date.getMonth()]}`;

            return (
              <View key={i} style={styles.dayCard}>
                {/* Day header */}
                <View style={styles.dayHeader}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateWd}>{WEEKDAYS_SHORT[day.date.getDay()]}</Text>
                    <Text style={styles.dateD}>{day.date.getDate()}</Text>
                    <Text style={styles.dateM}>{MONTHS[day.date.getMonth()].slice(0, 3)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayTitle}>{dayLabel}</Text>
                    <Text style={[styles.dayHours, isLong && { color: '#F97316' }]}>
                      {formatDur(workH)} arbete · {formatDur(driveHours)} körning{isLong ? ' ⚠️' : ''}
                    </Text>
                    <View style={styles.track}>
                      <View style={{ flex: Math.min(fill, 1), backgroundColor: isLong ? '#F97316' : fill > 0.85 ? '#22C55E' : '#D4822A', borderRadius: 3 }} />
                      <View style={{ flex: Math.max(0, 1 - fill) }} />
                    </View>
                  </View>
                </View>

                {/* Jobs */}
                {day.items.map((entry, j) => {
                  const { job, client, splitDay, splitHours } = entry;
                  const isPinned = !!job.manualDate;
                  const displayHours = splitHours ?? job.duration;

                  return (
                    <TouchableOpacity
                      key={`${job.id}-${j}`}
                      style={styles.jobRow}
                      onPress={() => navigation.navigate('JobDetail', { client, job })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.dot, { backgroundColor: POT_COLORS[client.potential] }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.jobTop}>
                          <Text style={styles.jobName}>{client.name}</Text>
                          {splitDay && <View style={styles.splitTag}><Text style={styles.splitTagTxt}>Del {splitDay}/2</Text></View>}
                          {isPinned && <Text style={{ fontSize: 12 }}>📌</Text>}
                        </View>
                        <View style={styles.jobMetaRow}>
                          <Text style={styles.jobMetaChip}>⏱ {formatDur(displayHours)}</Text>
                          {entry.driveFromPrevKm > 0 && (
                            <Text style={styles.jobMetaChip}>🚗 {Math.round(entry.driveFromPrevKm)} km</Text>
                          )}
                          {!!client.location.address && (
                            <Text style={[styles.jobMetaChip, { flex: 1 }]} numberOfLines={1}>📍 {client.location.address.split(',')[0]}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.jobActions}>
                        <TouchableOpacity
                          style={[styles.fastBtn, entry.job.locked && styles.fastBtnOn]}
                          onPress={() => toggleLock(entry)}
                        >
                          <Text style={[styles.fastBtnTxt, entry.job.locked && styles.fastBtnTxtOn]}>
                            {entry.job.locked ? 'Fäst ✓' : 'Fäst'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moveBtn} onPress={() => removeFromDay(entry)}>
                          <Text style={styles.moveBtnTxt}>✎</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Return home row */}
                {day.returnKm > 0 && (
                  <View style={styles.returnRow}>
                    <Text style={styles.returnTxt}>🏠 {Math.round(day.returnKm)} km hem</Text>
                  </View>
                )}

                {/* Route button */}
                <TouchableOpacity style={styles.routeBtn} onPress={() => {
                  const pts = day.items
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
                  if (pts.length === 0) { Alert.alert('Inga koordinater', 'Inga jobb på denna dag har registrerade koordinater.'); return; }
                  navigation.navigate('RouteMap', {
                    points: pts,
                    homeCoords: settings?.homeLat ? { lat: settings.homeLat, lng: settings.homeLng } : null,
                    dateLabel: dayLabel,
                  });
                }}>
                  <Text style={styles.routeBtnTxt}>🗺️ Visa rutt</Text>
                </TouchableOpacity>

                {/* Add job to this day */}
                <TouchableOpacity style={styles.addToDay}
                  onPress={() => {
                    // Show unscheduled + non-pinned jobs to add to this day
                    const allPending = [...unscheduled];
                    if (allPending.length === 0) {
                      Alert.alert('Inga lediga jobb', 'Alla jobb är redan schemalagda.');
                      return;
                    }
                    // For simplicity, let user pick from unscheduled
                    Alert.alert(
                      'Lägg till jobb',
                      'Välj ett jobb att lägga till på denna dag',
                      [
                        ...allPending.slice(0, 5).map(({ job, client }) => ({
                          text: `${client.name} (${formatDur(job.duration)})`,
                          onPress: () => pinToDate(job, day.date),
                        })),
                        { text: 'Avbryt', style: 'cancel' as const },
                      ]
                    );
                  }}>
                  <Text style={styles.addToDayTxt}>+ Lägg till jobb på denna dag</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Move/pin date picker modal */}
      <Modal visible={!!moveTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Flytta jobb till</Text>
            <Text style={styles.modalClient}>{moveTarget?.client.name}</Text>
            <FlatList
              data={weekdays}
              keyExtractor={d => d.toISOString()}
              style={{ maxHeight: 340 }}
              renderItem={({ item: date }) => (
                <TouchableOpacity style={styles.dateOption}
                  onPress={() => moveTarget && pinToDate(moveTarget.job, date)}>
                  <Text style={styles.dateWdOpt}>{WEEKDAYS_FULL[date.getDay()]}</Text>
                  <Text style={styles.dateDateOpt}>{date.getDate()} {MONTHS[date.getMonth()]}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.autoBtn}
              onPress={() => moveTarget && pinToDate(moveTarget.job, null)}>
              <Text style={styles.autoBtnTxt}>🤖 Låt appen schemalägga automatiskt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMoveTarget(null)}>
              <Text style={styles.cancelBtnTxt}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  statsCard: { backgroundColor: '#1A3057', borderRadius: 16, padding: 16, flexDirection: 'row', marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLbl: { fontSize: 10, color: '#93C5FD', marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDiv: { width: 1, backgroundColor: '#2D4A6E' },
  unschedBox: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
  unschedTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  unschedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  unschedName: { flex: 1, fontSize: 13, color: '#78350F', fontWeight: '500' },
  unschedPin: { fontSize: 12, color: '#D97706', fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A3057', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  dayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  dateBox: { backgroundColor: '#1A3057', borderRadius: 12, width: 52, height: 64, alignItems: 'center', justifyContent: 'center' },
  dateWd: { fontSize: 10, color: '#93C5FD', fontWeight: '700', textTransform: 'uppercase' },
  dateD: { fontSize: 22, color: '#fff', fontWeight: '800', lineHeight: 26 },
  dateM: { fontSize: 10, color: '#93C5FD', fontWeight: '600' },
  dayTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  dayHours: { fontSize: 12, color: '#6B7280', marginBottom: 5 },
  track: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  jobRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  jobMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  jobMetaChip: { fontSize: 11, color: '#6B7280' },
  jobName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  splitTag: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  splitTagTxt: { fontSize: 10, color: '#3B82F6', fontWeight: '700' },
  pinnedTag: { paddingHorizontal: 4 },
  pinnedTagTxt: { fontSize: 12 },
  jobMeta: { fontSize: 12, color: '#9CA3AF', marginBottom: 1 },
  jobAddr: { fontSize: 11, color: '#9CA3AF' },
  jobActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  fastBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  fastBtnOn: { backgroundColor: '#FFF7ED', borderColor: '#D4822A' },
  fastBtnTxt: { fontSize: 12, color: '#9CA3AF', fontWeight: '700' },
  fastBtnTxtOn: { color: '#D4822A' },
  moveBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  moveBtnTxt: { fontSize: 14, color: '#6B7280' },
  returnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, marginTop: 2 },
  returnTxt: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  routeBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center' },
  routeBtnTxt: { fontSize: 13, color: '#1A3057', fontWeight: '700' },
  addToDay: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'center' },
  addToDayTxt: { fontSize: 13, color: '#D4822A', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 13, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  modalClient: { fontSize: 20, fontWeight: '800', color: '#1A3057', textAlign: 'center', marginBottom: 16 },
  dateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dateWdOpt: { fontSize: 15, fontWeight: '600', color: '#374151', width: 80 },
  dateDateOpt: { fontSize: 15, color: '#111827' },
  autoBtn: { marginTop: 14, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  autoBtnTxt: { fontSize: 14, fontWeight: '700', color: '#1A3057' },
  cancelBtn: { marginTop: 8, padding: 14, alignItems: 'center' },
  cancelBtnTxt: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  overdueBox: { backgroundColor: '#FFF7ED', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#FED7AA' },
  overdueTitle: { fontSize: 14, fontWeight: '700', color: '#C2410C', marginBottom: 4 },
  overdueSub: { fontSize: 12, color: '#9A3412', marginBottom: 10, lineHeight: 17 },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  overdueName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1C1917' },
  overduePin: { fontSize: 12, color: '#D4822A', fontWeight: '600' },
  todayCard: { backgroundColor: '#1A3057', borderRadius: 18, padding: 18, marginBottom: 14 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  todayPill: { backgroundColor: '#D4822A', color: '#fff', fontSize: 10, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, letterSpacing: 1 },
  todayDate: { fontSize: 15, fontWeight: '700', color: '#fff' },
  todayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  todayDot: { width: 10, height: 10, borderRadius: 5 },
  todayName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  todayTime: { fontSize: 12, color: '#93C5FD', fontWeight: '600' },
  todayDrive: { fontSize: 11, color: '#64748B', marginLeft: 4 },
  todayFooter: { borderTopWidth: 1, borderTopColor: '#2D4A6E', marginTop: 6, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayFooterTxt: { fontSize: 12, color: '#93C5FD' },
  todayMapLink: { fontSize: 13, color: '#D4822A', fontWeight: '700' },
});
