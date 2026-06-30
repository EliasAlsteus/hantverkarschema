import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { saveClient, saveJob, updateClient, updateJob, getSettings } from '../storage';
import { geocodeAddress } from '../utils/geocode';
import AddressInput from '../components/AddressInput';
import { Client, Job, JobStatus } from '../types';

const POT_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const POT_LABELS = ['', 'Låg', 'Under medel', 'Medel', 'Bra', 'Topp'];
const QUICK_MINS = [15, 30, 60, 120, 180, 240, 480];

const INIT_STATUS_OPTIONS: { key: JobStatus; label: string; desc: string; color: string }[] = [
  { key: 'förfrågan',  label: 'Förfrågan',  desc: 'Kunden har hört av sig, inget mer ännu',  color: '#8B5CF6' },
  { key: 'offert',     label: 'Offert',     desc: 'Offert är skickad och inväntar svar',      color: '#3B82F6' },
  { key: 'accepterad', label: 'Accepterad', desc: 'Kunden har tackat ja — jobbet är aktivt',  color: '#EAB308' },
];

function RatingPicker({ label, sub, value, onChange, colors, labels }: {
  label: string; sub?: string; value: number; onChange: (n: number) => void;
  colors: string[]; labels: string[];
}) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>{label}</Text>
      {sub && <Text style={s.sublabel}>{sub}</Text>}
      <View style={s.ratingRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n}
            style={[s.ratingBtn, value === n && { backgroundColor: colors[n], borderColor: colors[n] }]}
            onPress={() => onChange(n)}>
            <Text style={[s.ratingNum, value === n && { color: '#fff' }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && <Text style={[s.ratingLabel, { color: colors[value] }]}>{labels[value]}</Text>}
    </View>
  );
}

function TimePicker({ hours, minutes, onHours, onMinutes }: {
  hours: number; minutes: number;
  onHours: (h: number) => void; onMinutes: (m: number) => void;
}) {
  const total = hours * 60 + minutes;
  const adjust = (d: number) => {
    const t = Math.max(5, Math.min(24 * 60, total + d));
    onHours(Math.floor(t / 60)); onMinutes(t % 60);
  };
  const lbl = total === 0 ? '–'
    : `${hours > 0 ? `${hours} tim` : ''}${hours > 0 && minutes > 0 ? ' ' : ''}${minutes > 0 ? `${minutes} min` : ''}`;
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>Arbetstid</Text>
      <Text style={s.sublabel}>Hur lång tid tar jobbet (exklusive körtid)?</Text>
      <View style={s.timeRow}>
        <TouchableOpacity style={s.timeBtn} onPress={() => adjust(-15)}>
          <Text style={s.timeBtnTxt}>−</Text>
        </TouchableOpacity>
        <View style={s.timeVal}><Text style={s.timeNum}>{lbl}</Text></View>
        <TouchableOpacity style={s.timeBtn} onPress={() => adjust(15)}>
          <Text style={s.timeBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={s.quickRow}>
        {QUICK_MINS.map(m => {
          const h = Math.floor(m / 60), min = m % 60;
          const lbl2 = h > 0 && min > 0 ? `${h}t${min}` : h > 0 ? `${h}t` : `${min}m`;
          const on = total === m;
          return (
            <TouchableOpacity key={m} style={[s.quickBtn, on && s.quickBtnOn]}
              onPress={() => { onHours(h); onMinutes(min); }}>
              <Text style={[s.quickBtnTxt, on && s.quickBtnTxtOn]}>{lbl2}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AddJobScreen({ route, navigation }: any) {
  const editClient: Client | undefined = route.params?.editClient;
  const editJob: Job | undefined = route.params?.editJob;
  const isEdit = !!editClient;

  const [name, setName] = useState(editClient?.name ?? '');
  const [phone, setPhone] = useState(editClient?.phone ?? '');
  const [email, setEmail] = useState(editClient?.email ?? '');
  const [address, setAddress] = useState(editClient?.location.address ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    editClient && (editClient.location.lat !== 0 || editClient.location.lng !== 0)
      ? { lat: editClient.location.lat, lng: editClient.location.lng }
      : null
  );
  const [potential, setPotential] = useState(editClient?.potential ?? 3);
  const totalEditMins = editJob ? Math.round(editJob.duration * 60) : 120;
  const [hours, setHours] = useState(Math.floor(totalEditMins / 60));
  const [minutes, setMinutes] = useState(totalEditMins % 60);
  const [initStatus, setInitStatus] = useState<JobStatus>(editJob?.status ?? 'förfrågan');
  const [notes, setNotes] = useState(editJob?.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(editJob?.photos ?? []);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Behörighet saknas', 'Gå till Inställningar på telefonen och tillåt åtkomst för denna app.');
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsMultipleSelection: false });
      if (result.canceled || !result.assets?.length) return;
      setPhotos(prev => [...prev, result.assets[0].uri]);
    } catch (e: any) {
      Alert.alert('Fel', 'Kunde inte öppna kameran/biblioteket: ' + (e?.message ?? String(e)));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Fel', 'Kundens namn saknas');
    if (!address.trim()) return Alert.alert('Fel', 'Adress saknas');
    const totalHours = hours + minutes / 60;
    if (totalHours < 0.08) return Alert.alert('Fel', 'Ange hur lång tid jobbet tar');
    setSaving(true);
    try {
      const resolved = coords ?? await geocodeAddress(address.trim());
      if (isEdit && editClient && editJob) {
        await updateClient({
          ...editClient,
          name: name.trim(), phone: phone.trim(), email: email.trim(),
          notes: '', potential,
          location: { lat: resolved?.lat ?? 0, lng: resolved?.lng ?? 0, address: address.trim() },
        });
        await updateJob({
          ...editJob,
          duration: Math.round(totalHours * 100) / 100,
          notes: notes.trim(), photos,
        });
      } else {
        const client = await saveClient({
          name: name.trim(), phone: phone.trim(), email: email.trim(),
          notes: '', potential,
          location: { lat: resolved?.lat ?? 0, lng: resolved?.lng ?? 0, address: address.trim() },
        });
        const s = await getSettings();
        await saveJob({
          clientId: client.id,
          duration: Math.round(totalHours * 100) / 100,
          status: initStatus,
          notes: notes.trim(), photos,
          addedBy: s.userName || undefined,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Fel', 'Kunde inte spara: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F4F7' }} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        <View style={s.section}>
          <Text style={s.sectionTitle}>👤 Kundinformation</Text>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Namn *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="t.ex. Andersson — kök" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Telefon</Text>
            <TextInput style={s.input} value={phone} onChangeText={setPhone}
              placeholder="070 000 00 00" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.label}>E-post</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail}
              placeholder="kund@exempel.se" placeholderTextColor="#9CA3AF"
              keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Adress *</Text>
            <AddressInput
              value={address}
              onChange={t => { setAddress(t); setCoords(null); }}
              onSelect={(addr, lat, lng) => { setAddress(addr); setCoords({ lat, lng }); }}
            />
            <Text style={s.sublabel}>
              {coords ? '✓ Koordinater hittade — korrekt adress vald' : 'Börja skriva för adressförslag'}
            </Text>
          </View>
          <RatingPicker label="Kundpotential" sub="Hur värdefull är kunden långsiktigt?"
            value={potential} onChange={setPotential} colors={POT_COLORS} labels={POT_LABELS} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>🔨 Jobbdetaljer</Text>
          <TimePicker hours={hours} minutes={minutes} onHours={setHours} onMinutes={setMinutes} />
          <View style={s.fieldGroup}>
            <Text style={s.label}>Anteckningar</Text>
            <TextInput style={[s.input, { height: 90 }]} value={notes} onChangeText={setNotes}
              placeholder="Extra info om jobbet..." placeholderTextColor="#9CA3AF"
              multiline textAlignVertical="top" />
          </View>
        </View>

        {!isEdit && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>📋 Status</Text>
            <Text style={s.sublabel}>Var i processen befinner ni er just nu?</Text>
            <View style={s.statusOptions}>
              {INIT_STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.statusOpt, initStatus === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '12' }]}
                  onPress={() => setInitStatus(opt.key)}
                >
                  <View style={[s.statusOptDot, { backgroundColor: opt.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.statusOptLabel, initStatus === opt.key && { color: opt.color }]}>{opt.label}</Text>
                    <Text style={s.statusOptDesc}>{opt.desc}</Text>
                  </View>
                  {initStatus === opt.key && <Text style={[s.statusOptCheck, { color: opt.color }]}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>📷 Foton</Text>
          <Text style={s.sublabel}>Lägg till bilder på platsen eller jobbet</Text>
          <View style={s.photoActions}>
            <TouchableOpacity style={s.photoBtn} onPress={() => pickPhoto(true)}>
              <Text style={s.photoBtnIcon}>📸</Text>
              <Text style={s.photoBtnTxt}>Ta foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.photoBtn} onPress={() => pickPhoto(false)}>
              <Text style={s.photoBtnIcon}>🖼️</Text>
              <Text style={s.photoBtnTxt}>Bildbibliotek</Text>
            </TouchableOpacity>
          </View>
          {photos.length > 0 && (
            <View style={s.photoGrid}>
              {photos.map((uri, i) => (
                <View key={i} style={s.photoThumbWrap}>
                  <Image source={{ uri }} style={s.photoThumb} />
                  <TouchableOpacity style={s.photoRemove}
                    onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnTxt}>{isEdit ? 'Spara ändringar' : 'Lägg till jobb'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A3057', marginBottom: 12 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sublabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', alignItems: 'center' },
  ratingNum: { fontSize: 16, fontWeight: '700', color: '#374151' },
  ratingLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  timeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A3057', justifyContent: 'center', alignItems: 'center' },
  timeBtnTxt: { fontSize: 22, color: '#fff', fontWeight: '700', lineHeight: 26 },
  timeVal: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  timeNum: { fontSize: 18, fontWeight: '700', color: '#111827' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  quickBtnOn: { backgroundColor: '#1A3057', borderColor: '#1A3057' },
  quickBtnTxt: { fontSize: 13, fontWeight: '600', color: '#374151' },
  quickBtnTxtOn: { color: '#fff' },
  statusOptions: { gap: 10, marginTop: 8 },
  statusOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  statusOptDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  statusOptDesc: { fontSize: 12, color: '#9CA3AF' },
  statusOptCheck: { fontSize: 16, fontWeight: '800' },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#E5E7EB' },
  photoBtnIcon: { fontSize: 18 },
  photoBtnTxt: { fontSize: 14, fontWeight: '600', color: '#374151' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: '#D4822A', borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 4 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
