import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings, saveSettings, AppSettings, getClients, getJobs } from '../storage';
import { geocodeAddress } from '../utils/geocode';

const DRIVE_OPTIONS = [
  { label: '20 km', desc: '~15–20 min', km: 20 },
  { label: '40 km', desc: '~30 min', km: 40 },
  { label: '60 km', desc: '~45 min', km: 60 },
  { label: '80 km', desc: '~1 timme', km: 80 },
  { label: '100 km', desc: '~1,5 tim', km: 100 },
  { label: '150 km', desc: '~2 timmar', km: 150 },
];

type Stats = { clients: number; doneJobs: number; totalJobs: number; addedByMe: number };

export default function SettingsScreen({ navigation }: any) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Stats>({ clients: 0, doneJobs: 0, totalJobs: 0, addedByMe: 0 });

  useEffect(() => {
    Promise.all([getSettings(), getClients(), getJobs()]).then(([s, clients, jobs]) => {
      setSettings(s);
      setAddress(s.homeAddress);
      setStats({
        clients: clients.length,
        doneJobs: jobs.filter(j => j.status === 'klar').length,
        totalJobs: jobs.length,
        addedByMe: jobs.filter(j => j.addedBy === s.userName && !!s.userName).length,
      });
    });
  }, []);

  const handleSave = async () => {
    if (!address.trim()) return Alert.alert('Fel', 'Ange din hemort');
    if (!settings) return;
    setSaving(true);
    try {
      const coords = await geocodeAddress(address.trim());
      if (!coords) {
        Alert.alert('Hittades inte', 'Kunde inte hitta adressen. Kontrollera stavningen.');
        setSaving(false);
        return;
      }
      const updated: AppSettings = {
        ...settings,
        homeAddress: address.trim(),
        homeLat: coords.lat,
        homeLng: coords.lng,
      };
      await saveSettings(updated);
      setSettings(updated);
      Alert.alert('Sparat ✓', `Hemort satt till ${address.trim()}`);
    } catch {
      Alert.alert('Fel', 'Kunde inte spara inställningarna');
    } finally {
      setSaving(false);
    }
  };

  const setMaxDrive = async (km: number) => {
    if (!settings) return;
    const updated = { ...settings, maxDriveKm: km };
    await saveSettings(updated);
    setSettings(updated);
  };

  if (!settings) return null;

  const homeSet = settings.homeLat !== 0;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* Profile stats */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarTxt}>{settings?.userName ? settings.userName[0].toUpperCase() : '?'}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{settings?.userName ?? '—'}</Text>
              <Text style={styles.profileSub}>Hantverkare</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.clients}</Text>
              <Text style={styles.statLbl}>Kunder</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.doneJobs}</Text>
              <Text style={styles.statLbl}>Gjorda jobb</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.totalJobs}</Text>
              <Text style={styles.statLbl}>Inlagda jobb</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.addedByMe}</Text>
              <Text style={styles.statLbl}>Av mig</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Din hemort</Text>
          <Text style={styles.sectionDesc}>
            Ange staden eller adressen du utgår från varje dag. Appen använder detta för att planera
            jobb som är nära dig och varandra.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Hemort / Startadress</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="t.ex. Borås"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />
          </View>

          {homeSet && (
            <View style={styles.homeConfirm}>
              <Text style={styles.homeConfirmTxt}>✓ Hemort registrerad: {settings.homeAddress}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnTxt}>Spara hemort</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Max körsträcka per dag</Text>
          <Text style={styles.sectionDesc}>
            Jobb som ligger längre bort än detta avstånd från övriga jobb läggs på en annan dag.
            "1 timme" är ett bra standardvärde för de flesta.
          </Text>

          <View style={styles.driveGrid}>
            {DRIVE_OPTIONS.map(opt => {
              const active = settings.maxDriveKm === opt.km;
              return (
                <TouchableOpacity
                  key={opt.km}
                  style={[styles.driveBtn, active && styles.driveBtnActive]}
                  onPress={() => setMaxDrive(opt.km)}
                >
                  <Text style={[styles.driveBtnKm, active && styles.driveBtnTxtActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.driveBtnDesc, active && { color: '#93C5FD' }]}>
                    {opt.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Hur fungerar planeringen?</Text>
          <Text style={styles.infoText}>
            {'• Appen planerar automatiskt din arbetsdag (8 timmar).\n\n'}
            {'• Jobb som ligger nära varandra och nära din hemort prioriteras att läggas samma dag.\n\n'}
            {'• Jobb med hög kundpotential prioriteras om avståndet är ungefär lika.\n\n'}
            {'• Du kan alltid flytta ett jobb till ett annat datum på Schema-fliken.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.tutorialBtn} onPress={() => navigation.navigate('Tutorial')}>
          <Text style={styles.tutorialBtnIcon}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tutorialBtnTitle}>Visa tutorial</Text>
            <Text style={styles.tutorialBtnSub}>Gå igenom appens funktioner igen</Text>
          </View>
          <Text style={styles.tutorialBtnArrow}>›</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  profileCard: { backgroundColor: '#1A3057', borderRadius: 18, padding: 18, marginBottom: 14 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#D4822A', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 24, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileSub: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  statsGrid: { flexDirection: 'row', backgroundColor: '#243F6A', borderRadius: 12, padding: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 10, color: '#93C5FD', marginTop: 3, fontWeight: '600', textAlign: 'center' },
  statDiv: { width: 1, backgroundColor: '#2D4A6E', marginVertical: 4 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A3057', marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 14 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 16, color: '#111827' },
  homeConfirm: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 10, marginBottom: 12 },
  homeConfirmTxt: { fontSize: 13, color: '#16A34A', fontWeight: '600' },
  saveBtn: { backgroundColor: '#1A3057', borderRadius: 12, padding: 15, alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  driveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  driveBtn: { width: '30%', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 12, alignItems: 'center' },
  driveBtnActive: { backgroundColor: '#1A3057', borderColor: '#1A3057' },
  driveBtnKm: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driveBtnDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 3, fontWeight: '500' },
  driveBtnTxtActive: { color: '#fff' },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },
  tutorialBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tutorialBtnIcon: { fontSize: 26 },
  tutorialBtnTitle: { fontSize: 15, fontWeight: '700', color: '#1A3057' },
  tutorialBtnSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  tutorialBtnArrow: { fontSize: 22, color: '#D1D5DB' },
});
