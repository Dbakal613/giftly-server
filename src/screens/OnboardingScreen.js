import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';

const STORES = [
  { key: 'falabella',     label: 'Falabella',     emoji: '🟠' },
  { key: 'ripley',        label: 'Ripley',         emoji: '🔵' },
  { key: 'paris',         label: 'Paris',          emoji: '🟢' },
  { key: 'mercadolibre',  label: 'MercadoLibre',   emoji: '⚫' },
];

const INTERESTS = [
  'Tecnología', 'Moda', 'Hogar', 'Deportes',
  'Belleza', 'Juguetes', 'Libros', 'Viajes',
  'Gaming', 'Cocina', 'Mascotas', 'Música',
];

const STEPS = [
  { id: 'welcome' },
  { id: 'stores' },
  { id: 'interests' },
];

export default function OnboardingScreen({ onDone }) {
  const [step, setStep]               = useState(0);
  const [selectedStores, setSelectedStores]       = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [saving, setSaving]           = useState(false);

  function toggleStore(key) {
    setSelectedStores(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  }

  function toggleInterest(label) {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Mark in localStorage immediately (works on web without needing DB columns)
        try { localStorage.setItem(`onboarding_done_${user.id}`, '1'); } catch {}
        // Try saving to DB (may fail if columns don't exist yet — that's OK)
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            preferred_stores: selectedStores,
            preferred_categories: selectedInterests,
            onboarding_done: true,
          });
        } catch {}
      }
    } catch (e) {
      console.error('Onboarding error:', e);
    } finally {
      setSaving(false);
      onDone();
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  function skip() { onDone(); }

  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.container}>
      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Step content */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* STEP 0 — Welcome */}
        {step === 0 && (
          <View style={styles.slide}>
            <Text style={styles.emoji}>🎁</Text>
            <Text style={styles.title}>Bienvenida a Giftly</Text>
            <Text style={styles.sub}>Encuentra los mejores precios, arma tu lista de deseos y coordina regalos grupales con tus amigos.</Text>
            <View style={styles.features}>
              <View style={styles.feat}>
                <Text style={styles.featEmoji}>🔍</Text>
                <View>
                  <Text style={styles.featTitle}>Compara precios</Text>
                  <Text style={styles.featDesc}>Falabella, Ripley, Paris y MercadoLibre en un solo lugar</Text>
                </View>
              </View>
              <View style={styles.feat}>
                <Text style={styles.featEmoji}>🛍️</Text>
                <View>
                  <Text style={styles.featTitle}>Tu lista de deseos</Text>
                  <Text style={styles.featDesc}>Guarda lo que quieres comprar y recibe alertas de precio</Text>
                </View>
              </View>
              <View style={styles.feat}>
                <Text style={styles.featEmoji}>👥</Text>
                <View>
                  <Text style={styles.featTitle}>Regalos grupales</Text>
                  <Text style={styles.featDesc}>Organiza una vaca con tus amigos para regalar algo especial</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* STEP 1 — Tiendas */}
        {step === 1 && (
          <View style={styles.slide}>
            <Text style={styles.emoji}>🏪</Text>
            <Text style={styles.title}>¿Qué tiendas usas?</Text>
            <Text style={styles.sub}>Selecciona tus favoritas para personalizar tu experiencia</Text>
            <View style={styles.storeGrid}>
              {STORES.map(store => {
                const selected = selectedStores.includes(store.key);
                return (
                  <TouchableOpacity
                    key={store.key}
                    style={[styles.storeBtn, selected && styles.storeBtnActive]}
                    onPress={() => toggleStore(store.key)}
                  >
                    <Text style={styles.storeEmoji}>{store.emoji}</Text>
                    <Text style={[styles.storeLabel, selected && styles.storeLabelActive]}>{store.label}</Text>
                    {selected && <Text style={styles.storeCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2 — Intereses */}
        {step === 2 && (
          <View style={styles.slide}>
            <Text style={styles.emoji}>✨</Text>
            <Text style={styles.title}>¿Qué te interesa?</Text>
            <Text style={styles.sub}>Elige las categorías que más te gustan</Text>
            <View style={styles.interestGrid}>
              {INTERESTS.map(label => {
                const selected = selectedInterests.includes(label);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.interestBtn, selected && styles.interestBtnActive]}
                    onPress={() => toggleInterest(label)}
                  >
                    <Text style={[styles.interestLabel, selected && styles.interestLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btnPrimary} onPress={next} disabled={saving}>
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={styles.btnPrimaryText}>{isLast ? '¡Empezar! 🎉' : 'Continuar →'}</Text>
          }
        </TouchableOpacity>
        {!isLast && (
          <TouchableOpacity onPress={skip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#FAFAF7' },
  dots:               { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 60, paddingBottom: 8 },
  dot:                { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8E8E2' },
  dotActive:          { width: 24, borderRadius: 4, backgroundColor: '#D94F3D' },
  scroll:             { padding: 28, paddingBottom: 16 },
  slide:              { alignItems: 'center' },
  emoji:              { fontSize: 64, marginBottom: 20 },
  title:              { fontSize: 26, fontWeight: '700', color: '#1A1A18', marginBottom: 12, textAlign: 'center' },
  sub:                { fontSize: 15, color: '#8A8A82', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  features:           { width: '100%', gap: 12 },
  feat:               { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  featEmoji:          { fontSize: 24 },
  featTitle:          { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 2 },
  featDesc:           { fontSize: 13, color: '#8A8A82', lineHeight: 18 },
  storeGrid:          { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  storeBtn:           { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  storeBtnActive:     { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  storeEmoji:         { fontSize: 20 },
  storeLabel:         { fontSize: 14, fontWeight: '500', color: '#1A1A18', flex: 1 },
  storeLabelActive:   { color: '#D94F3D' },
  storeCheck:         { color: '#D94F3D', fontWeight: '700' },
  interestGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  interestBtn:        { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, borderWidth: 2, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  interestBtnActive:  { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  interestLabel:      { fontSize: 14, color: '#8A8A82', fontWeight: '500' },
  interestLabelActive:{ color: '#D94F3D', fontWeight: '600' },
  bottom:             { padding: 24, paddingBottom: 40, gap: 10 },
  btnPrimary:         { backgroundColor: '#D94F3D', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText:     { color: 'white', fontSize: 16, fontWeight: '700' },
  skipBtn:            { alignItems: 'center', padding: 10 },
  skipText:           { fontSize: 14, color: '#8A8A82' },
});
