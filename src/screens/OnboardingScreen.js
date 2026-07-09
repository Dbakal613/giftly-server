import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const STORES = [
  { key: 'falabella',    label: 'Falabella',    emoji: '🟠' },
  { key: 'ripley',       label: 'Ripley',        emoji: '🔵' },
  { key: 'paris',        label: 'Paris',         emoji: '🟢' },
  { key: 'mercadolibre', label: 'MercadoLibre',  emoji: '⚫' },
];

const INTERESTS = [
  'Tecnología', 'Moda', 'Hogar', 'Deportes',
  'Belleza', 'Juguetes', 'Libros', 'Viajes',
  'Gaming', 'Cocina', 'Mascotas', 'Música',
];

const STEPS = [
  { id: 'welcome' },
  { id: 'photo' },
  { id: 'stores' },
  { id: 'interests' },
  { id: 'privacy' },
];

const LIST_LABELS = [
  { key: 'want_to_buy',   icon: '🛍️', label: 'Quiero comprar' },
  { key: 'bought',        icon: '✅', label: 'Compré' },
  { key: 'recommend',     icon: '👍', label: 'Recomiendo' },
  { key: 'not_recommend', icon: '👎', label: 'No recomiendo' },
];

const VIS_OPTIONS = [
  { key: 'public',  label: 'Público',  desc: 'Cualquiera' },
  { key: 'friends', label: 'Amigos',   desc: 'Solo amigos' },
  { key: 'private', label: 'Solo yo',  desc: 'Nadie más' },
];

export default function OnboardingScreen({ onDone }) {
  const [step, setStep]                           = useState(0);
  const [photoUri, setPhotoUri]                   = useState(null);
  const [uploadingPhoto, setUploadingPhoto]       = useState(false);
  const [avatarUrl, setAvatarUrl]                 = useState(null);
  const [userInitial, setUserInitial]             = useState('?');
  const [selectedStores, setSelectedStores]       = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [listVisibility, setListVisibility]       = useState({
    want_to_buy:   'public',
    bought:        'friends',
    recommend:     'public',
    not_recommend: 'private',
  });
  const [saving, setSaving] = useState(false);
  const avatarUrlRef = useRef(null);

  // Load initial when arriving at photo step
  async function onPhotoStepEnter() {
    if (userInitial !== '?') return;
    const { data: { user } } = await supabase.auth.getUser();
    const name = user?.user_metadata?.name || user?.user_metadata?.username || user?.email || '';
    setUserInitial(name.charAt(0).toUpperCase() || '?');
  }

  async function pickPhoto() {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setUploadingPhoto(true);
      const dataUrl = await resizeToDataUrl(uri);
      avatarUrlRef.current = dataUrl;
      setAvatarUrl(dataUrl);
    } catch (e) {
      console.error('pickPhoto error:', e);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function resizeToDataUrl(uri) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 200; c.height = 200;
        c.getContext('2d').drawImage(img, 0, 0, 200, 200);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = uri;
    });
  }

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

  function setAllListVisibility(value) {
    setListVisibility({ want_to_buy: value, bought: value, recommend: value, not_recommend: value });
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try { localStorage.setItem(`onboarding_done_${user.id}`, '1'); } catch {}
        // Read existing profile so we don't overwrite name/username set by auth provider
        const { data: existing } = await supabase
          .from('profiles').select('name,username').eq('id', user.id).maybeSingle();
        const upsertData = {
          id:                   user.id,
          preferred_stores:     selectedStores,
          preferred_categories: selectedInterests,
          profile_visibility:   profileVisibility,
          list_visibility:      listVisibility,
          onboarding_done:      true,
        };
        if (avatarUrlRef.current) upsertData.avatar_url = avatarUrlRef.current;
        if (!existing?.name)     upsertData.name     = user.user_metadata?.name     || '';
        if (!existing?.username) upsertData.username = user.user_metadata?.username || '';
        await supabase.from('profiles').upsert(upsertData);
      }
    } catch (e) {
      console.error('Onboarding error:', e);
    } finally {
      setSaving(false);
      onDone();
    }
  }

  function next() {
    if (step === 0) {
      onPhotoStepEnter();
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  function skipPhoto() {
    setPhotoUri(null);
    setAvatarUrl(null);
    setStep(step + 1);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── PASO 0: Bienvenida ── */}
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

        {/* ── PASO 1: Foto de perfil ── */}
        {step === 1 && (
          <View style={styles.slide}>
            <Text style={styles.emoji}>📸</Text>
            <Text style={styles.title}>Tu foto de perfil</Text>
            <Text style={styles.sub}>Pon una foto para que tus amigos te reconozcan al enviarte solicitudes.</Text>

            {/* Avatar preview */}
            <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} disabled={uploadingPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarPhoto} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{userInitial}</Text>
                </View>
              )}
              {uploadingPhoto ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="white" />
                </View>
              ) : (
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>📷</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnUpload}
              onPress={pickPhoto}
              disabled={uploadingPhoto}
            >
              <Text style={styles.btnUploadText}>
                {photoUri ? 'Cambiar foto' : 'Subir foto'}
              </Text>
            </TouchableOpacity>

            {photoUri && (
              <Text style={styles.photoOk}>✓ Foto lista</Text>
            )}
          </View>
        )}

        {/* ── PASO 2: Tiendas ── */}
        {step === 2 && (
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

        {/* ── PASO 3: Intereses ── */}
        {step === 3 && (
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

        {/* ── PASO 4: Privacidad ── */}
        {step === 4 && (
          <View style={styles.slide}>
            <Text style={styles.emoji}>🔒</Text>
            <Text style={styles.title}>Tu privacidad</Text>
            <Text style={styles.sub}>Controla quién puede ver tu perfil y tus listas. Puedes cambiarlo cuando quieras en Ajustes.</Text>

            <View style={styles.privSection}>
              <Text style={styles.privLabel}>¿Quién puede encontrarte?</Text>
              <View style={styles.visRow}>
                {[{ key: 'public', label: '🌍 Público', desc: 'Cualquiera puede buscar tu perfil' },
                  { key: 'private', label: '🔒 Privado', desc: 'Solo tus amigos pueden verte' }].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.visCard, profileVisibility === opt.key && styles.visCardActive]}
                    onPress={() => setProfileVisibility(opt.key)}
                  >
                    <Text style={[styles.visCardTitle, profileVisibility === opt.key && styles.visCardTitleActive]}>{opt.label}</Text>
                    <Text style={styles.visCardDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.privSection}>
              <Text style={styles.privLabel}>¿Quién puede ver tus listas?</Text>
              <Text style={styles.privSub}>Puedes ajustar cada lista individualmente después</Text>
              <View style={styles.quickSet}>
                {VIS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.quickChip,
                      Object.values(listVisibility).every(v => v === opt.key) && styles.quickChipActive]}
                    onPress={() => setAllListVisibility(opt.key)}
                  >
                    <Text style={[styles.quickChipText,
                      Object.values(listVisibility).every(v => v === opt.key) && styles.quickChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {LIST_LABELS.map(list => (
                <View key={list.key} style={styles.listVisRow}>
                  <Text style={styles.listVisIcon}>{list.icon}</Text>
                  <Text style={styles.listVisLabel}>{list.label}</Text>
                  <View style={styles.listVisChips}>
                    {VIS_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.miniChip, listVisibility[list.key] === opt.key && styles.miniChipActive]}
                        onPress={() => setListVisibility(prev => ({ ...prev, [list.key]: opt.key }))}
                      >
                        <Text style={[styles.miniChipText, listVisibility[list.key] === opt.key && styles.miniChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.btnPrimary, (saving || uploadingPhoto) && { opacity: 0.6 }]}
          onPress={next}
          disabled={saving || uploadingPhoto}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={styles.btnPrimaryText}>{isLast ? '¡Empezar! 🎉' : 'Continuar →'}</Text>
          }
        </TouchableOpacity>

        {/* Skip only on photo step */}
        {step === 1 && !photoUri && (
          <TouchableOpacity style={styles.skipBtn} onPress={skipPhoto}>
            <Text style={styles.skipText}>Usar mis iniciales por ahora</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F8F5F0' },
  dots:               { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 60, paddingBottom: 8 },
  dot:                { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E2DDD5' },
  dotActive:          { width: 24, borderRadius: 4, backgroundColor: '#B85C45' },
  scroll:             { padding: 28, paddingBottom: 16 },
  slide:              { alignItems: 'center' },
  emoji:              { fontSize: 64, marginBottom: 20 },
  title:              { fontSize: 26, fontWeight: '700', color: '#1C1916', marginBottom: 12, textAlign: 'center' },
  sub:                { fontSize: 15, color: '#6E6860', textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  // Features (step 0)
  features:           { width: '100%', gap: 12 },
  feat:               { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2DDD5' },
  featEmoji:          { fontSize: 24 },
  featTitle:          { fontSize: 14, fontWeight: '600', color: '#1C1916', marginBottom: 2 },
  featDesc:           { fontSize: 13, color: '#6E6860', lineHeight: 18 },

  // Photo (step 1)
  avatarWrap:         { width: 130, height: 130, marginBottom: 24, position: 'relative' },
  avatarPhoto:        { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: '#B85C45' },
  avatarPlaceholder:  { width: 130, height: 130, borderRadius: 65, backgroundColor: '#B85C45', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#B85C45' },
  avatarInitial:      { fontSize: 52, fontWeight: '800', color: 'white' },
  avatarOverlay:      { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarBadge:        { position: 'absolute', bottom: 4, right: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: '#1C1916', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F8F5F0' },
  avatarBadgeText:    { fontSize: 16 },
  btnUpload:          { borderWidth: 1.5, borderColor: '#B85C45', borderRadius: 100, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 10 },
  btnUploadText:      { fontSize: 15, fontWeight: '600', color: '#B85C45' },
  photoOk:            { fontSize: 14, color: '#3E7A5E', fontWeight: '600' },

  // Stores (step 2)
  storeGrid:          { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  storeBtn:           { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#E2DDD5', backgroundColor: '#FFFFFF' },
  storeBtnActive:     { borderColor: '#B85C45', backgroundColor: '#E8C4B8' },
  storeEmoji:         { fontSize: 20 },
  storeLabel:         { fontSize: 14, fontWeight: '500', color: '#1C1916', flex: 1 },
  storeLabelActive:   { color: '#B85C45' },
  storeCheck:         { color: '#B85C45', fontWeight: '700' },

  // Interests (step 3)
  interestGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  interestBtn:        { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, borderWidth: 2, borderColor: '#E2DDD5', backgroundColor: '#FFFFFF' },
  interestBtnActive:  { borderColor: '#B85C45', backgroundColor: '#E8C4B8' },
  interestLabel:      { fontSize: 14, color: '#6E6860', fontWeight: '500' },
  interestLabelActive:{ color: '#B85C45', fontWeight: '600' },

  // Privacy (step 4)
  privSection:        { width: '100%', marginBottom: 24 },
  privLabel:          { fontSize: 13, fontWeight: '700', color: '#1C1916', marginBottom: 4 },
  privSub:            { fontSize: 12, color: '#6E6860', marginBottom: 10 },
  visRow:             { flexDirection: 'row', gap: 10 },
  visCard:            { flex: 1, borderWidth: 2, borderColor: '#E2DDD5', borderRadius: 14, padding: 14, backgroundColor: '#FFFFFF' },
  visCardActive:      { borderColor: '#B85C45', backgroundColor: '#E8C4B8' },
  visCardTitle:       { fontSize: 14, fontWeight: '600', color: '#1C1916', marginBottom: 4 },
  visCardTitleActive: { color: '#B85C45' },
  visCardDesc:        { fontSize: 12, color: '#6E6860', lineHeight: 16 },
  quickSet:           { flexDirection: 'row', gap: 8, marginBottom: 14 },
  quickChip:          { flex: 1, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: '#E2DDD5', backgroundColor: '#FFFFFF', alignItems: 'center' },
  quickChipActive:    { borderColor: '#B85C45', backgroundColor: '#E8C4B8' },
  quickChipText:      { fontSize: 12, color: '#6E6860', fontWeight: '500' },
  quickChipTextActive:{ color: '#B85C45', fontWeight: '700' },
  listVisRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F2EDE6' },
  listVisIcon:        { fontSize: 18 },
  listVisLabel:       { fontSize: 13, fontWeight: '500', color: '#1C1916', flex: 1 },
  listVisChips:       { flexDirection: 'row', gap: 4 },
  miniChip:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1.5, borderColor: '#E2DDD5', backgroundColor: '#FFFFFF' },
  miniChipActive:     { borderColor: '#B85C45', backgroundColor: '#E8C4B8' },
  miniChipText:       { fontSize: 11, color: '#6E6860', fontWeight: '500' },
  miniChipTextActive: { color: '#B85C45', fontWeight: '700' },

  // Bottom
  bottom:             { padding: 24, paddingBottom: 40, gap: 8 },
  btnPrimary:         { backgroundColor: '#B85C45', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText:     { color: 'white', fontSize: 16, fontWeight: '700' },
  skipBtn:            { alignItems: 'center', padding: 10 },
  skipText:           { fontSize: 14, color: '#6E6860' },
});
