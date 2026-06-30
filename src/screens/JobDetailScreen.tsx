import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Linking, Alert, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateJob, deleteJob, deleteClient } from '../storage';
import { Client, Job, JobStatus } from '../types';

const STATUS_STEPS: { key: JobStatus; label: string; color: string; bg: string }[] = [
  { key: 'förfrågan',  label: 'Förfrågan',  color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'offert',     label: 'Offert',     color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'accepterad', label: 'Accepterad', color: '#D97706', bg: '#FEF3C7' },
  { key: 'klar',       label: 'Klar ✓',    color: '#16A34A', bg: '#DCFCE7' },
];

const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const POT_LABELS = ['', 'Låg potential', 'Under medel', 'Medel potential', 'Bra potential', 'Topp potential'];
const { width: SW } = Dimensions.get('window');

function formatDuration(h: number) {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} timmar`;
  return `${hrs} tim ${mins} min`;
}

export default function JobDetailScreen({ route, navigation }: any) {
  const { client, job }: { client: Client; job: Job } = route.params;
  const [currentJob, setCurrentJob] = useState<Job>(job);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const setStatus = async (s: JobStatus) => {
    const updated = { ...currentJob, status: s };
    await updateJob(updated);
    setCurrentJob(updated);
  };

  const handleDelete = () => {
    Alert.alert('Ta bort jobb', 'Vill du ta bort detta jobb och kunden?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort', style: 'destructive', onPress: async () => {
          await deleteJob(currentJob.id);
          await deleteClient(client.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const openMaps = () => {
    const q = encodeURIComponent(client.location.address);
    Linking.canOpenURL('maps://').then(ok =>
      Linking.openURL(ok ? `maps://?q=${q}` : `https://maps.google.com/?q=${q}`)
    );
  };

  const curStatusIdx = STATUS_STEPS.findIndex(s => s.key === currentJob.status);
  const curStatusMeta = STATUS_STEPS[curStatusIdx] ?? STATUS_STEPS[0];
  const photos = currentJob.photos ?? [];

  return (
    <SafeAreaView style={st.container} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* Hero */}
        <View style={st.heroCard}>
          <View style={[st.potStripe, { backgroundColor: POT_COLORS[client.potential] }]} />
          <View style={{ flex: 1, padding: 16 }}>
            <View style={st.heroTop}>
              <Text style={st.heroName}>{client.name}</Text>
              <TouchableOpacity
                style={st.editBtn}
                onPress={() => navigation.navigate('AddJob', { editClient: client, editJob: currentJob })}>
                <Text style={st.editBtnTxt}>✎ Redigera</Text>
              </TouchableOpacity>
            </View>
            <View style={[st.potBadge, { backgroundColor: POT_COLORS[client.potential] + '22', borderColor: POT_COLORS[client.potential] }]}>
              <Text style={[st.potBadgeTxt, { color: POT_COLORS[client.potential] }]}>★ {POT_LABELS[client.potential]}</Text>
            </View>
            {!!client.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${client.phone}`)} style={{ marginTop: 8 }}>
                <Text style={st.contactLink}>📞 {client.phone}</Text>
              </TouchableOpacity>
            )}
            {!!client.email && (
              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${client.email}`)} style={{ marginTop: 4 }}>
                <Text style={st.contactLink}>✉️ {client.email}</Text>
              </TouchableOpacity>
            )}
            <View style={[st.statusBanner, { backgroundColor: curStatusMeta.bg }]}>
              <Text style={[st.statusBannerTxt, { color: curStatusMeta.color }]}>● {curStatusMeta.label}</Text>
            </View>
          </View>
        </View>

        {/* Address */}
        {!!client.location.address && (
          <TouchableOpacity style={st.card} onPress={openMaps}>
            <View style={st.cardRow}>
              <Text style={st.cardIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.cardLabel}>Adress</Text>
                <Text style={st.cardValue}>{client.location.address}</Text>
                <Text style={st.cardMeta}>
                  {client.location.lat !== 0 ? 'Koordinater registrerade · ' : ''}Tryck för vägbeskrivning
                </Text>
              </View>
              <Text style={st.arrow}>↗</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Job details */}
        <View style={st.card}>
          <Text style={st.cardTitle}>🔨 Jobbdetaljer</Text>
          <View style={st.detailGrid}>
            <View style={st.detailBox}>
              <Text style={st.detailNum}>{formatDuration(currentJob.duration)}</Text>
              <Text style={st.detailLbl}>Arbetstid</Text>
            </View>
          </View>
          {!!currentJob.notes && (
            <View style={st.notesBox}>
              <Text style={st.notesLabel}>Anteckningar</Text>
              <Text style={st.notesText}>{currentJob.notes}</Text>
            </View>
          )}
          {!!currentJob.addedBy && (
            <View style={st.addedByRow}>
              <Text style={st.addedByTxt}>👤 Inlagt av {currentJob.addedBy}</Text>
            </View>
          )}
        </View>

        {/* Photos */}
        {photos.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>📷 Foton ({photos.length})</Text>
            <View style={st.photoGrid}>
              {photos.map((uri, i) => (
                <TouchableOpacity key={i} onPress={() => setLightboxUri(uri)}>
                  <Image
                    source={{ uri }}
                    style={st.photoThumb}
                    onError={() => {}} // silently ignore broken URIs
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Status stepper */}
        <View style={st.stepperCard}>
          <Text style={st.stepperLabel}>Status</Text>
          <View style={st.stepperRow}>
            {STATUS_STEPS.map((s, i) => (
              <TouchableOpacity
                key={s.key}
                style={[st.stepperBtn, curStatusIdx === i && { backgroundColor: s.bg, borderColor: s.color }]}
                onPress={() => setStatus(s.key)}
              >
                <Text style={[st.stepperBtnTxt, curStatusIdx === i && { color: s.color }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {curStatusIdx < STATUS_STEPS.length - 1 && (
            <TouchableOpacity
              style={[st.actionBtn, st.actionBtnDone]}
              onPress={() => setStatus(STATUS_STEPS[curStatusIdx + 1].key)}
            >
              <Text style={st.actionBtnTxt}>
                {curStatusIdx === 0 ? '✓ Markera som accepterad' : '✓ Markera som klar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={st.deleteBtn} onPress={handleDelete}>
          <Text style={st.deleteBtnTxt}>🗑 Ta bort jobb</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!lightboxUri} transparent animationType="fade">
        <TouchableOpacity style={st.lightbox} onPress={() => setLightboxUri(null)} activeOpacity={1}>
          {lightboxUri && <Image source={{ uri: lightboxUri }} style={st.lightboxImg} resizeMode="contain" />}
          <Text style={st.lightboxClose}>✕</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  heroCard: { backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', overflow: 'hidden', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  potStripe: { width: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 },
  editBtn: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnTxt: { fontSize: 13, fontWeight: '700', color: '#1A3057' },
  potBadge: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  potBadgeTxt: { fontSize: 11, fontWeight: '700' },
  contactLink: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  statusBanner: { marginTop: 10, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  statusBannerTxt: { fontWeight: '700', fontSize: 13 },
  stepperCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  stepperLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 10 },
  stepperRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stepperBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 8, alignItems: 'center' },
  stepperBtnTxt: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 22 },
  cardLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 15, color: '#111827', fontWeight: '600', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#3B82F6', marginTop: 4 },
  arrow: { fontSize: 18, color: '#9CA3AF' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A3057', marginBottom: 14 },
  detailGrid: { flexDirection: 'row', gap: 12 },
  detailBox: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, alignItems: 'center' },
  detailNum: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailLbl: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontWeight: '600', textAlign: 'center' },
  notesBox: { marginTop: 14, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 },
  notesLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  addedByRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  addedByTxt: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoThumb: { width: (SW - 96) / 3, height: (SW - 96) / 3, borderRadius: 10, backgroundColor: '#F3F4F6' },
  actionBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  actionBtnDone: { backgroundColor: '#1A3057' },
  actionBtnUndo: { backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  actionBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  deleteBtn: { borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  deleteBtnTxt: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  lightboxImg: { width: SW, height: SW * 1.3 },
  lightboxClose: { position: 'absolute', top: 60, right: 24, color: '#fff', fontSize: 24, fontWeight: '700' },
});
