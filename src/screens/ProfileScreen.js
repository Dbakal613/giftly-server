import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Image, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius } from '../lib/theme';
import { VISIBILITY_OPTIONS } from '../constants';
import { getCurrentUser, signOut } from '../services/auth';
import { fetchProfile, updateProfile, isUsernameTaken } from '../services/profiles';
import ScreenHeader from '../components/ScreenHeader';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfileScreen({ navigation }) {
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [editing, setEditing]       = useState(false);
  const [name, setName]             = useState('');
  const [username, setUsername]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [saveError, setSaveError]   = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      const { data } = await fetchProfile(currentUser.id);
      if (data) {
        setProfile(data);
        setName(data.name || '');
        setUsername(data.username || '');
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaveError('');
    const trimmed = username.trim().toLowerCase();

    if (!USERNAME_RE.test(trimmed)) {
      setSaveError('El usuario debe tener 3–20 caracteres: solo letras minúsculas, números y guión bajo (_)');
      return;
    }

    if (trimmed !== profile?.username) {
      const taken = await isUsernameTaken(trimmed, user.id);
      if (taken) {
        setSaveError('Ese nombre de usuario ya está en uso. Prueba con otro.');
        return;
      }
    }

    const { error } = await updateProfile(user.id, { name: name.trim(), username: trimmed });
    if (error) { setSaveError(error.message); return; }
    setEditing(false);
    loadProfile();
  }

  async function handleProfileVisibility(value) {
    setSavingPrivacy(true);
    await updateProfile(user.id, { profile_visibility: value });
    await loadProfile();
    setSavingPrivacy(false);
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
      await updateProfile(user.id, { avatar_url: dataUrl });
      setProfile(prev => ({ ...prev, avatar_url: dataUrl }));
    } catch (e) {
      console.error('pickAndUploadAvatar error:', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  const profileVis = profile?.profile_visibility || 'public';

  return (
    <ScrollView style={styles.container}>
      <ScreenHeader
        title="Mi perfil"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => { setEditing(!editing); setSaveError(''); }}>
            <Text style={styles.editBtn}>{editing ? 'Cancelar' : 'Editar'}</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={editing ? pickAndUploadAvatar : undefined}
          disabled={uploadingAvatar}
          activeOpacity={editing ? 0.8 : 1}
        >
          {(localAvatarUri || profile?.avatar_url) ? (
            <Image source={{ uri: localAvatarUri || profile.avatar_url }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.name || user?.email || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {editing && (
            <View style={styles.avatarOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator color="white" />
                : <Feather name="camera" size={22} color="white" />
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
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={t => { setName(t); setSaveError(''); }}
              placeholder="Tu nombre"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.inputLabel}>Usuario</Text>
            <View style={styles.usernameWrap}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={t => { setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, '')); setSaveError(''); }}
                placeholder="tu_usuario"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.muted}
              />
            </View>
            <Text style={styles.hint}>3–20 caracteres · solo letras, números y _</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
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

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Friends')}>
          <View style={styles.menuIcon}><Feather name="users" size={17} color={colors.muted} /></View>
          <Text style={styles.menuLabel}>Mis amigos</Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.menuIcon}><Feather name="bell" size={17} color={colors.muted} /></View>
          <Text style={styles.menuLabel}>Notificaciones</Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, showPrivacy && styles.menuItemActive]}
          onPress={() => setShowPrivacy(p => !p)}
        >
          <View style={styles.menuIcon}><Feather name="lock" size={17} color={colors.muted} /></View>
          <Text style={[styles.menuLabel, showPrivacy && { color: colors.accent }]}>Privacidad</Text>
          <Feather name={showPrivacy ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
        </TouchableOpacity>

        {showPrivacy && (
          <View style={styles.privacyPanel}>
            {savingPrivacy && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.savingText}>Guardando...</Text>
              </View>
            )}
            <Text style={styles.privTitle}>¿Quién puede encontrarte?</Text>
            <View style={styles.visRow}>
              {[
                { key: 'public',  label: 'Público',  desc: 'Cualquiera puede buscar tu perfil' },
                { key: 'private', label: 'Privado',  desc: 'Solo tus amigos pueden verte' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.visCard, profileVis === opt.key && styles.visCardActive]}
                  onPress={() => handleProfileVisibility(opt.key)}
                >
                  <Text style={[styles.visCardTitle, profileVis === opt.key && styles.visCardTitleActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.visCardDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={signOut}>
          <View style={styles.menuIcon}><Feather name="log-out" size={17} color={colors.accent} /></View>
          <Text style={[styles.menuLabel, { color: colors.accent }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editBtn:      { fontSize: 15, color: colors.accent, fontWeight: '600' },

  avatarSection: { alignItems: 'center', padding: 28, backgroundColor: colors.surface, marginBottom: 12 },
  avatarWrap:    { width: 80, height: 80, borderRadius: 40, marginBottom: 14, position: 'relative' },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: 'white', fontSize: 32, fontWeight: '700' },
  avatarPhoto:   { width: 80, height: 80, borderRadius: 40 },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  profileInfo:   { alignItems: 'center' },
  profileName:   { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  profileUsername: { fontSize: 14, color: colors.muted, marginBottom: 2 },
  profileEmail:  { fontSize: 13, color: colors.muted },

  editForm:    { width: '100%', gap: 4 },
  errorBox:    { backgroundColor: colors.redBg, borderRadius: radius.sm, padding: 12, marginBottom: 8 },
  errorText:   { color: colors.accent, fontSize: 13, fontWeight: '500' },
  inputLabel:  { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  input:       { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.bg, marginBottom: 12 },
  usernameWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: 4 },
  usernameAt:  { paddingLeft: 12, fontSize: 15, color: colors.muted, fontWeight: '600' },
  usernameInput: { flex: 1, padding: 12, paddingLeft: 6, fontSize: 15, color: colors.ink },
  hint:        { fontSize: 11, color: colors.muted, marginBottom: 12 },
  saveBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  menu:          { backgroundColor: colors.surface, marginHorizontal: 16, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.tagBg },
  menuItemActive: { backgroundColor: colors.bg },
  menuItemDanger: { borderBottomWidth: 0 },
  menuIcon:      { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  menuLabel:     { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '500' },

  privacyPanel: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.tagBg, gap: 4 },
  savingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  savingText:   { fontSize: 12, color: colors.muted },
  privTitle:    { fontSize: 11, fontWeight: '700', color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  visRow:       { flexDirection: 'row', gap: 8 },
  visCard:      { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.bg },
  visCardActive: { borderColor: colors.accent, backgroundColor: colors.redBg },
  visCardTitle: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  visCardTitleActive: { color: colors.accent },
  visCardDesc:  { fontSize: 11, color: colors.muted, lineHeight: 15 },
});
