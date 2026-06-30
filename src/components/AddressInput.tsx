import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from 'react-native';

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

function cleanLabel(s: Suggestion): string {
  const a = s.address ?? {};
  const parts = [
    a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road,
    a.city ?? a.town ?? a.village ?? a.municipality,
    a.postcode,
  ].filter(Boolean);
  return parts.length >= 2 ? parts.join(', ') : s.display_name.split(',').slice(0, 3).join(',').trim();
}

type Props = {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
};

export default function AddressInput({ value, onChange, onSelect, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=8&countrycodes=se&addressdetails=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'CarpenterScheduler/1.0 elias.alsteus@gmail.com' } });
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  }, []);

  const handleChange = (text: string) => {
    onChange(text);
    search(text);
  };

  const handleSelect = (s: Suggestion) => {
    const label = cleanLabel(s);
    onChange(label);
    onSelect(label, parseFloat(s.lat), parseFloat(s.lon));
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder ?? 'Storgatan 12, Borås'}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && <ActivityIndicator size="small" color="#1A3057" style={styles.spinner} />}
      </View>
      {open && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => handleSelect(s)}
            >
              <Text style={styles.suggestionIcon}>📍</Text>
              <Text style={styles.suggestionTxt} numberOfLines={2}>{cleanLabel(s)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10 },
  input: { flex: 1, padding: 12, fontSize: 15, color: '#111827' },
  spinner: { marginRight: 10 },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 99, marginTop: 4, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggestionIcon: { fontSize: 14 },
  suggestionTxt: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 19 },
});
