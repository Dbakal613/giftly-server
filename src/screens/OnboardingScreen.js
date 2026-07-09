import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';

const STORES = [
  { key: 'falabella',    label: 'Falabella' },
  { key: 'ripley',       label: 'Ripley' },
  { key: 'paris',        label: 'Paris' },
  { key: 'mercadolibre', label: 'MercadoLibre' },
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

const FEATURES = [
  { icon: 'search',    title: 'Compara precios',   desc: 'Falabella, Ripley, Paris y MercadoLibre en un solo lugar' },
  { icon: 'list',      title: 'Tu wishlist',        desc: 'Guarda lo que quieres comprar y recibe alertas de precio' },
  { icon: 'users',     title: 'Regalos grupales',   desc: 'Organiza una vaca con tus amigos para regalar algo especial' },
];

const STEP_ICONS = ['gift', 'camera', 'shopping-bag', 'star', 'shield'];

const PROFILE_VIS_OPTIONS = [
  { key: 'public',  label: 'Público',  icon: 'globe',  desc: 'Cualquiera puede encontrarte' },
  { key: 'private', label: 'Privado',  icon: 'lock',   desc: 'Solo tus amigos pueden verte' },
];

export default function OnboardingScreen({ onDone }) {
  const [step, setStep]                           = useState(0);
  const [photoUri, setPhotoUri]                   = useState(null);
  const [uploadingPhoto, setUploadingPhoto]       = useState(false);
  const [userInitial, setUserInitial]             = useState('?');
  const [selectedStores, setSelectedStores]       = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const avatarUrlRef = useRef(null);

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

  async function finish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try { localStorage.setItem(`onboarding_done_${user.id}`, '1'); } catch {}
        const { data: existing } = await supabase
          .from('profiles').select('name,username').eq('id', user.id).maybeSingle();
        const upsertData = {
          id:                   user.id,
          preferred_stores:     selectedStores,
          preferred_categories: selectedInterests,
          profile_visibility:   profileVisibility,
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
    avatarUrlRef.current = null;
    setStep(step + 1);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── PASO 0: Bienvenida ── */}
        {step === 0 && (
          <View style={styles.slide}>
            <View style={styles.heroIconWrap}>
              <Feather name="gift" size={40} color={colors.accent} />
            </View>
            <Text style={styles.title}>Bienvenida a Giftly</Text>
            <Text style={styles.sub}>Encuentra los mejores precios, arma tu lista de deseos y coordina regalos grupales con tus amigos.</Text>
            <View style={styles.features}>
              {FEATURES.map(feat => (
                <View key={feat.icon} style={styles.feat}>
                  <View style={styles.featIconWrap}>
                    <Feather name={feat.icon} size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featTitle}>{feat.title}</Text>
                    <Text style={styles.featDesc}>{feat.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── PASO 1: Foto de perfil ── */}
        {step === 1 && (
          <View style={styles.slide}>
            <View style={styles.heroIconWrap}>
              <Feather name="camera" size={40} color={colors.accent} />
            </View>
            <Text style={styles.title}>Tu foto de perfil</Text>
            <Text style={styles.sub}>Pon una foto para que tus amigos te reconozcan al enviarte solicitudes.</Text>

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
                  <Feather name="camera" size={14} color="white" />
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
              <View style={styles.photoOkRow}>
                <Feather name="check-circle" size={15} color={colors.green} />
                <Text style={styles.photoOk}>Foto cargada</Text>
              </View>
            )}
          </View>
        )}

        {/* ── PASO 2: Tiendas ── */}
        {step === 2 && (
          <View style={styles.slide}>
            <View style={styles.heroIconWrap}>
              <Feather name="shopping-bag" size={40} color={colors.accent} />
            </View>
            <Text style={styles.title}>Tiendas favoritas</Text>
            <Text style={styles.sub}>Selecciona tus favoritas para personalizar tu experiencia.</Text>
            <View style={styles.storeGrid}>
              {STORES.map(store => {
                const isSelected = selectedStores.includes(store.key);
                return (
                  <TouchableOpacity
                    key={store.key}
                    style={[styles.storeBtn, isSelected && styles.storeBtnActive]}
                    onPress={() => toggleStore(store.key)}
                  >
                    <View style={[styles.storeIconWrap, isSelected && styles.storeIconWrapActive]}>
                      <Feather name="shopping-bag" size={16} color={isSelected ? colors.accent : colors.muted} />
                    </View>
                    <Text style={[styles.storeLabel, isSelected && styles.storeLabelActive]}>{store.label}</Text>
                    {isSelected && <Feather name="check" size={14} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PASO 3: Intereses ── */}
        {step === 3 && (
          <View style={styles.slide}>
            <View style={styles.heroIconWrap}>
              <Feather name="star" size={40} color={colors.accent} />
            </View>
            <Text style={styles.title}>¿Qué te interesa?</Text>
            <Text style={styles.sub}>Elige las categorías que más te gustan.</Text>
            <View style={styles.interestGrid}>
              {INTERESTS.map(label => {
                const isSelected = selectedInterests.includes(label);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.interestBtn, isSelected && styles.interestBtnActive]}
                    onPress={() => toggleInterest(label)}
                  >
                    <Text style={[styles.interestLabel, isSelected && styles.interestLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PASO 4: Privacidad ── */}
        {step === 4 && (
          <View style={styles.slide}>
            <View style={styles.heroIconWrap}>
              <Feather name="shield" size={40} color={colors.accent} />
            </View>
            <Text style={styles.title}>Tu privacidad</Text>
            <Text style={styles.sub}>Controla quién puede ver tu perfil. Puedes cambiarlo cuando quieras desde tus ajustes.</Text>

            <View style={styles.privSection}>
              <Text style={styles.privLabel}>¿Quién puede encontrarte?</Text>
              <View style={styles.visRow}>
                {PROFILE_VIS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.visCard, profileVisibility === opt.key && styles.visCardActive]}
                    onPress={() => setProfileVisibility(opt.key)}
                  >
                    <View style={[styles.visCardIconWrap, profileVisibility === opt.key && styles.visCardIconWrapActive]}>
                      <Feather name={opt.icon} size={16} color={profileVisibility === opt.key ? colors.accent : colors.muted} />
                    </View>
                    <Text style={[styles.visCardTitle, profileVisibility === opt.key && styles.visCardTitleActive]}>{opt.label}</Text>
                    <Text style={styles.visCardDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.privNote}>
              <Feather name="info" size={14} color={colors.muted} />
              <Text style={styles.privNoteText}>
                La visibilidad de cada wishlist se controla individualmente al crearla.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.btnPrimary, (saving || uploadingPhoto) && { opacity: 0.6 }]}
          onPress={next}
          disabled={saving || uploadingPhoto}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : (
              <View style={styles.btnPrimaryContent}>
                <Text style={styles.btnPrimaryText}>{isLast ? 'Comenzar' : 'Continuar'}</Text>
                <Feather name={isLast ? 'check' : 'arrow-right'} size={17} color="white" />
              </View>
            )
          }
        </TouchableOpacity>

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
  container:           { flex: 1, backgroundColor: colors.bg },
  dots:                { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 60, paddingBottom: 8 },
  dot:                 { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive:           { width: 24, borderRadius: 4, backgroundColor: colors.accent },
  scroll:              { padding: 28, paddingBottom: 16 },
  slide:               { alignItems: 'center' },

  heroIconWrap:        { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:               { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 },
  sub:                 { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  features:            { width: '100%', gap: 10 },
  feat:                { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  featIconWrap:        { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featTitle:           { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  featDesc:            { fontSize: 13, color: colors.muted, lineHeight: 18 },

  avatarWrap:          { width: 130, height: 130, marginBottom: 24, position: 'relative' },
  avatarPhoto:         { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: colors.accent },
  avatarPlaceholder:   { width: 130, height: 130, borderRadius: 65, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.accent },
  avatarInitial:       { fontSize: 52, fontWeight: '800', color: 'white' },
  avatarOverlay:       { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarBadge:         { position: 'absolute', bottom: 4, right: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  btnUpload:           { borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 10 },
  btnUploadText:       { fontSize: 15, fontWeight: '600', color: colors.accent },
  photoOkRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoOk:             { fontSize: 14, color: colors.green, fontWeight: '600' },

  storeGrid:           { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  storeBtn:            { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  storeBtnActive:      { borderColor: colors.accent, backgroundColor: colors.accentLight },
  storeIconWrap:       { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  storeIconWrapActive: { backgroundColor: 'rgba(184,92,69,0.12)' },
  storeLabel:          { fontSize: 14, fontWeight: '500', color: colors.ink, flex: 1 },
  storeLabelActive:    { color: colors.accent },

  interestGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  interestBtn:         { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  interestBtnActive:   { borderColor: colors.accent, backgroundColor: colors.accentLight },
  interestLabel:       { fontSize: 14, color: colors.muted, fontWeight: '500' },
  interestLabelActive: { color: colors.accent, fontWeight: '600' },

  privSection:         { width: '100%', marginBottom: 24 },
  privLabel:           { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  visRow:              { flexDirection: 'row', gap: 12 },
  visCard:             { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: 16, backgroundColor: colors.surface, alignItems: 'flex-start', gap: 8 },
  visCardActive:       { borderColor: colors.accent, backgroundColor: colors.accentLight },
  visCardIconWrap:     { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  visCardIconWrapActive: { backgroundColor: 'rgba(184,92,69,0.12)' },
  visCardTitle:        { fontSize: 14, fontWeight: '600', color: colors.ink },
  visCardTitleActive:  { color: colors.accent },
  visCardDesc:         { fontSize: 12, color: colors.muted, lineHeight: 16 },

  privNote:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.tagBg, borderRadius: radius.md, padding: 14, width: '100%' },
  privNoteText:        { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 18 },

  bottom:              { padding: 24, paddingBottom: 40, gap: 8 },
  btnPrimary:          { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  btnPrimaryContent:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnPrimaryText:      { color: 'white', fontSize: 16, fontWeight: '700' },
  skipBtn:             { alignItems: 'center', padding: 10 },
  skipText:            { fontSize: 14, color: colors.muted },
});
