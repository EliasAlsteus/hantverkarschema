import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, TextInput,
} from 'react-native';

const { width: SW } = Dimensions.get('window');

export type Slide = {
  icon: string;
  title: string;
  body: string;
  bullets?: string[];
  accent?: string;
};

export const SLIDES: Slide[] = [
  {
    icon: '🔨',
    title: 'Jobb och offerter',
    body: 'Lägg in varje kund med adress och jobb. Stegen är enkla:',
    bullets: [
      '📋 Offert — du har skickat prisförslag',
      '✅ Accepterad — kunden tackar ja, jobbet schemaläggs',
      '🏁 Klar — jobbet är utfört',
    ],
    accent: '#1A3057',
  },
  {
    icon: '📅',
    title: 'Automatiskt schema',
    body: 'Appen bygger schemat åt dig. Den grupperar jobb som ligger nära varandra på samma dag — så du kör så lite som möjligt.',
    bullets: [
      '📍 Geografi styr — nära jobb hamnar samma dag',
      '⏱ Max 8 timmar per dag inkl. körtid',
      '⭐ Kunder med hög potential prioriteras',
      '📌 Du kan alltid fästa ett jobb på ett visst datum',
    ],
    accent: '#1A3057',
  },
  {
    icon: '🗺️',
    title: 'Karta och rutter',
    body: 'Se alla dina jobb på kartan. Tryck på en dag i schemat för att visa körsträckan som en linje på kartan.',
    bullets: [
      '📍 Alla jobb visas med färgkodade nålar',
      '🚗 Tryck "Visa rutt" för dagens körväg',
      '↗ Öppna rutten i Kartor för GPS-navigation',
    ],
    accent: '#1A3057',
  },
  {
    icon: '⚙️',
    title: 'Hemort och inställningar',
    body: 'Ange din hemadress i Inställningar — det är startpunkten som appen använder för att beräkna körtid och gruppera jobb.',
    bullets: [
      '🏠 Hemort = din utgångspunkt varje dag',
      '📏 Välj max köravstånd (standard: 60 km)',
      '🔄 Schemat uppdateras automatiskt varje dag',
    ],
    accent: '#1A3057',
  },
];

type Props = {
  showNameInput?: boolean;
  nameValue?: string;
  onNameChange?: (n: string) => void;
  onDone?: () => void;
  doneLabel?: string;
};

export default function TutorialSlides({ showNameInput, nameValue, onNameChange, onDone, doneLabel }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const totalPages = SLIDES.length + (showNameInput ? 1 : 0);

  const goTo = (p: number) => {
    scrollRef.current?.scrollTo({ x: p * SW, animated: true });
    setPage(p);
  };

  const next = () => {
    if (page < totalPages - 1) goTo(page + 1);
    else onDone?.();
  };

  const isLast = page === totalPages - 1;

  return (
    <View style={st.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {/* Name input slide — shown first if onboarding */}
        {showNameInput && (
          <View style={[st.slide, { width: SW }]}>
            <View style={st.iconCircle}>
              <Text style={st.iconTxt}>👋</Text>
            </View>
            <Text style={st.slideTitle}>Välkommen!</Text>
            <Text style={st.slideBody}>
              Den här appen hjälper dig planera din arbetsdag som hantverkare — smidigt, snabbt och utan papper.
            </Text>
            <Text style={st.slideBody}>Vad heter du?</Text>
            <TextInput
              style={st.nameInput}
              value={nameValue}
              onChangeText={onNameChange}
              placeholder="Ditt förnamn"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={next}
            />
          </View>
        )}

        {/* Tutorial slides */}
        {SLIDES.map((slide, i) => (
          <View key={i} style={[st.slide, { width: SW }]}>
            <View style={st.iconCircle}>
              <Text style={st.iconTxt}>{slide.icon}</Text>
            </View>
            <Text style={st.slideTitle}>{slide.title}</Text>
            <Text style={st.slideBody}>{slide.body}</Text>
            {slide.bullets && (
              <View style={st.bulletList}>
                {slide.bullets.map((b, j) => (
                  <View key={j} style={st.bulletRow}>
                    <Text style={st.bulletTxt}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={st.dots}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)}>
            <View style={[st.dot, i === page && st.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Nav buttons */}
      <View style={st.navRow}>
        {page > 0 ? (
          <TouchableOpacity style={st.backBtn} onPress={() => goTo(page - 1)}>
            <Text style={st.backBtnTxt}>← Tillbaka</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <TouchableOpacity
          style={[st.nextBtn, isLast && st.nextBtnDone]}
          onPress={next}
        >
          <Text style={st.nextBtnTxt}>{isLast ? (doneLabel ?? 'Klar!') : 'Nästa →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  slide: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 16 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  iconTxt: { fontSize: 40 },
  slideTitle: { fontSize: 24, fontWeight: '800', color: '#1A3057', textAlign: 'center', marginBottom: 14 },
  slideBody: { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  bulletList: { alignSelf: 'stretch', gap: 10 },
  bulletRow: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 13, borderLeftWidth: 3, borderLeftColor: '#D4822A' },
  bulletTxt: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  nameInput: { alignSelf: 'stretch', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 18, color: '#111827', textAlign: 'center', fontWeight: '600', marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { width: 22, backgroundColor: '#D4822A' },
  navRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  backBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  backBtnTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  nextBtn: { flex: 2, backgroundColor: '#1A3057', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  nextBtnDone: { backgroundColor: '#D4822A' },
  nextBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
