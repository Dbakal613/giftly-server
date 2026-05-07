import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

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
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').upsert({ id: user.id, name, username });
    if (error) { setSaveError(error.message); return; }
    setEditing(false);
    fetchProfile();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D94F3D" size="large" /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Text style={styles.editBtn}>{editing ? 'Cancelar' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name || user?.email || '?').charAt(0).toUpperCase()}</Text>
        </View>
        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tu nombre" />
            <Text style={styles.label}>Usuario</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="@tuusuario" autoCapitalize="none" />
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
          { label: 'Compré', icon: '✅' },
          { label: 'Recomiendo', icon: '👍' },
        ].map(stat => (
          <TouchableOpacity key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.options}>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Friends')}>
          <Text style={styles.optionIcon}>👥</Text>
          <Text style={styles.optionText}>Mis amigos</Text>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionIcon}>🔔</Text>
          <Text style={styles.optionText}>Notificaciones</Text>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionIcon}>🔒</Text>
          <Text style={styles.optionText}>Privacidad</Text>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.option, styles.optionDanger]} onPress={signOut}>
          <Text style={styles.optionIcon}>🚪</Text>
          <Text style={[styles.optionText, { color: '#D94F3D' }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A18' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  editBtn: { fontSize: 15, color: '#D94F3D', fontWeight: '600' },
  avatarSection: { alignItems: 'center', padding: 28, backgroundColor: '#FFFFFF', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { color: 'white', fontSize: 32, fontWeight: '700' },
  profileInfo: { alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#1A1A18', marginBottom: 4 },
  profileUsername: { fontSize: 14, color: '#8A8A82', marginBottom: 2 },
  profileEmail: { fontSize: 13, color: '#8A8A82' },
  editForm: { width: '100%', gap: 4 },
  label: { fontSize: 11, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 12, fontSize: 15, color: '#1A1A18', backgroundColor: '#FAFAF7', marginBottom: 12 },
  saveBtn: { backgroundColor: '#D94F3D', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E2' },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#8A8A82', textAlign: 'center', fontWeight: '500' },
  options: { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E8E2' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0EFE8' },
  optionDanger: { borderBottomWidth: 0 },
  optionIcon: { fontSize: 20 },
  optionText: { flex: 1, fontSize: 15, color: '#1A1A18', fontWeight: '500' },
  optionArrow: { fontSize: 16, color: '#8A8A82' },
});
