import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const LIST_LABELS = [
  { key: 'want_to_buy',   icon: '🛍️', label: 'Quiero comprar' },
  { key: 'bought',        icon: '✅', label: 'Compré' },
  { key: 'recommend',     icon: '👍', label: 'Recomiendo' },
  { key: 'not_recommend', icon: '👎', label: 'No recomiendo' },
];

const VIS_OPTIONS = [
  { key: 'public',  label: 'Público' },
  { key: 'friends', label: 'Amigos' },
  { key: 'private', label: 'Solo yo' },
];

export default function ProfileScreen({ navigation }) {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [editing, setEditing]     = useState(false);
  const [name, setName]           = useState('');
  const [username, setUsername]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [saveError, setSaveError] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) { setProfile(data); setName(data.name || ''); setUsername(data.username || ''); }
    }
    setLoading(false);
  }

  async function saveProfile() {
    setSaveError('');
    const trimmedUsername = username.trim().toLowerCase();

    if (trimmedUsername !== profile?.username) {
      if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
        setSaveError('El usuario debe tener 3–20 caracteres: solo letras minúsculas, números y guión bajo (_)');
        return;
      }
      const { data: taken } = await supabase
        .from('profiles').select('id').eq('username', trimmedUsername).maybeSingle();
      if (taken) {
        setSaveError('Ese nombre de usuario ya está en uso. Prueba con otro.');
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').upsert({ id: user.id, name: name.trim(), username: trimmedUsername });
    if (error) { setSaveError(error.message); return; }
    setEditing(false);
    fetchProfile();
  }

  async function saveProfileVisibility(value) {
    setSavingPrivacy(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').upsert({ id: user.id, profile_visibility: value });
    await fetchProfile();
    setSavingPrivacy(false);
  }

  async function saveListVisibility(listKey, value) {
    setSavingPrivacy(true);
    const current = profile?.list_visibility || {};
    const updated = { ...current, [listKey]: value };
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').upsert({ id: user.id, list_visibility: updated });
    await fetchProfile();
    setSavingPrivacy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
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

  async function pickAndUploadAvatar() {
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
      setLocalAvatarUri(uri);
      setUploadingAvatar(true);
      const dataUrl = await resizeToDataUrl(uri);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').upsert({ id: authUser.id, avatar_url: dataUrl });
      if (error) throw error;
      setProfile(prev => ({ ...prev, avatar_url: dataUrl }));
    } catch (e) {
      console.error('pickAndUploadAvatar error:', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D94F3D" size="large" /></View>;

  const profileVis  = profile?.profile_visibility || 'public';
  const listVis     = profile?.list_visibility    || {};

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
        <TouchableOpacity onPress={() => { setEditing(!editing); setSaveError(''); }}>
          <Text style={styles.editBtn}>{editing ? 'Cancelar' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={editing ? pickAndUploadAvatar : undefined}
          disabled={uploadingAvatar}
          activeOpacity={editing ? 0.8 : 1}
        >
          {(localAvatarUri || profile?.avatar_url) ? (
            <Image
              source={{ uri: localAvatarUri || profile.avatar_url }}
              style={styles.avatarPhoto}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.name || user?.email || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {editing && (
            <View style={styles.avatarEditOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator color="white" />
                : <Text style={{ fontSize: 22 }}>📷</Text>
              }
            </View>
          )}
        </TouchableOpacity>
        {editing ? (
          <View style={styles.editForm}>
            {saveError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={t => { setName(t); setSaveError(''); }}
              placeholder="Tu nombre"
            />
            <Text style={styles.label}>Usuario</Text>
            <View style={styles.usernameWrap}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={t => {
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setSaveError('');
                }}
                placeholder="tu_usuario"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.hint}>3–20 caracteres · solo letras, números y _</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name || 'Sin nombre'}</Text>
            <Text style={styles.profileUsername}>@{profile?.username || user?.email?.split('@')[0]}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Quiero comprar', icon: '🛍️' },
          { label: 'Compré',         icon: '✅' },
          { label: 'Recomiendo',     icon: '👍' },
        ].map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Options menu ── */}
      <View style={styles.options}>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Friends')}>
          <Text style={styles.optionIcon}>👥</Text>
          <Text style={styles.optionText}>Mis amigos</Text>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.optionIcon}>🔔</Text>
          <Text style={styles.optionText}>Notificaciones</Text>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, showPrivacy && styles.optionActive]}
          onPress={() => setShowPrivacy(p => !p)}
        >
          <Text style={styles.optionIcon}>🔒</Text>
          <Text style={[styles.optionText, showPrivacy && { color: '#D94F3D' }]}>Privacidad</Text>
          <Text style={styles.optionArrow}>{showPrivacy ? '↑' : '↓'}</Text>
        </TouchableOpacity>

        {/* ── Expandable privacy section ── */}
        {showPrivacy && (
          <View style={styles.privacyPanel}>
            {savingPrivacy && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color="#D94F3D" />
                <Text style={styles.savingText}>Guardando...</Text>
              </View>
            )}

            {/* Profile visibility */}
            <Text style={styles.privTitle}>¿Quién puede encontrarte?</Text>
            <View style={styles.visRow}>
              {[
                { key: 'public',  label: '🌍 Público',  desc: 'Cualquiera puede buscar tu perfil' },
                { key: 'private', label: '🔒 Privado',  desc: 'Solo tus amigos pueden verte' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.visCard, profileVis === opt.key && styles.visCardActive]}
                  onPress={() => saveProfileVisibility(opt.key)}
                >
                  <Text style={[styles.visCardTitle, profileVis === opt.key && styles.visCardTitleActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.visCardDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Per-list visibility */}
            <Text style={[styles.privTitle, { marginTop: 16 }]}>Visibilidad de listas</Text>
            {LIST_LABELS.map((list, idx) => (
              <View
                key={list.key}
                style={[styles.listVisRow, idx === 0 && { borderTopWidth: 0 }]}
              >
                <Text style={styles.listVisIcon}>{list.icon}</Text>
                <Text style={styles.listVisLabel}>{list.label}</Text>
                <View style={styles.listVisChips}>
                  {VIS_OPTIONS.map(opt => {
                    const current = listVis[list.key] || 'public';
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.miniChip, current === opt.key && styles.miniChipActive]}
                        onPress={() => saveListVisibility(list.key, opt.key)}
                      >
                        <Text style={[styles.miniChipText, current === opt.key && styles.miniChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.option, styles.optionDanger]} onPress={signOut}>
          <Text style={styles.optionIcon}>🚪</Text>
          <Text style={[styles.optionText, { color: '#D94F3D' }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FAFAF7' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn:         { padding: 4 },
  backText:        { fontSize: 22, color: '#1A1A18' },
  headerTitle:     { fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  editBtn:         { fontSize: 15, color: '#D94F3D', fontWeight: '600' },
  avatarSection:      { alignItems: 'center', padding: 28, backgroundColor: '#FFFFFF', marginBottom: 12 },
  avatarWrap:         { width: 80, height: 80, borderRadius: 40, marginBottom: 14, position: 'relative' },
  avatar:             { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center' },
  avatarText:         { color: 'white', fontSize: 32, fontWeight: '700' },
  avatarPhoto:        { width: 80, height: 80, borderRadius: 40 },
  avatarEditOverlay:  { position: 'absolute', top: 0, left: 0, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  profileInfo:     { alignItems: 'center' },
  profileName:     { fontSize: 22, fontWeight: '700', color: '#1A1A18', marginBottom: 4 },
  profileUsername: { fontSize: 14, color: '#8A8A82', marginBottom: 2 },
  profileEmail:    { fontSize: 13, color: '#8A8A82' },

  // Edit form
  editForm:        { width: '100%', gap: 4 },
  errorBox:        { backgroundColor: '#FDE8E5', borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText:       { color: '#D94F3D', fontSize: 13, fontWeight: '500' },
  label:           { fontSize: 11, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  input:           { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 12, fontSize: 15, color: '#1A1A18', backgroundColor: '#FAFAF7', marginBottom: 12 },
  usernameWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, backgroundColor: '#FAFAF7', marginBottom: 4 },
  usernameAt:      { paddingLeft: 12, fontSize: 15, color: '#8A8A82', fontWeight: '600' },
  usernameInput:   { flex: 1, padding: 12, paddingLeft: 6, fontSize: 15, color: '#1A1A18' },
  hint:            { fontSize: 11, color: '#B0AFA8', marginBottom: 12 },
  saveBtn:         { backgroundColor: '#D94F3D', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText:     { color: 'white', fontWeight: '700', fontSize: 15 },

  // Stats
  statsRow:        { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard:        { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E2' },
  statIcon:        { fontSize: 24, marginBottom: 4 },
  statLabel:       { fontSize: 11, color: '#8A8A82', textAlign: 'center', fontWeight: '500' },

  // Options
  options:         { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E8E2' },
  option:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0EFE8' },
  optionActive:    { backgroundColor: '#FFF8F7' },
  optionDanger:    { borderBottomWidth: 0 },
  optionIcon:      { fontSize: 20 },
  optionText:      { flex: 1, fontSize: 15, color: '#1A1A18', fontWeight: '500' },
  optionArrow:     { fontSize: 16, color: '#8A8A82' },

  // Privacy panel
  privacyPanel:    { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0EFE8', gap: 4 },
  savingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  savingText:      { fontSize: 12, color: '#8A8A82' },
  privTitle:       { fontSize: 12, fontWeight: '700', color: '#1A1A18', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  visRow:          { flexDirection: 'row', gap: 8, marginBottom: 4 },
  visCard:         { flex: 1, borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 12, backgroundColor: '#FAFAF7' },
  visCardActive:   { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  visCardTitle:    { fontSize: 13, fontWeight: '600', color: '#1A1A18', marginBottom: 2 },
  visCardTitleActive: { color: '#D94F3D' },
  visCardDesc:     { fontSize: 11, color: '#8A8A82', lineHeight: 15 },
  listVisRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0EFE8', gap: 8 },
  listVisIcon:     { fontSize: 16 },
  listVisLabel:    { flex: 1, fontSize: 13, color: '#1A1A18', fontWeight: '500' },
  listVisChips:    { flexDirection: 'row', gap: 4 },
  miniChip:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1.5, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  miniChipActive:  { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  miniChipText:    { fontSize: 10, color: '#8A8A82', fontWeight: '500' },
  miniChipTextActive: { color: '#D94F3D', fontWeight: '700' },
});
