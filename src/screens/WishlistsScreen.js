/**
 * WishlistsScreen — manage named wishlists.
 * Requires the `wishlists` and `wishlist_items` tables in Supabase.
 * If tables don't exist, shows a setup banner instead of crashing.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Platform, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow } from '../lib/theme';

const PRESET_NAMES = [
  'Mi cumpleaños 🎂',
  'Cosas que quiero ✨',
  'Casa 🏡',
  'Ropa 👕',
  'Tech 💻',
  'Outdoor 🏔',
  'Libros 📚',
  'Para mí 💛',
];

const VISIBILITY_OPTIONS = [
  { key: 'public',  label: '🌍 Pública',  desc: 'Cualquiera con el link puede verla' },
  { key: 'friends', label: '👥 Amigos',   desc: 'Solo tus amigos en Giftly' },
  { key: 'private', label: '🔒 Privada',  desc: 'Solo tú' },
];

export default function WishlistsScreen({ navigation }) {
  const [wishlists, setWishlists]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newVis, setNewVis]           = useState('public');
  const [creating, setCreating]       = useState(false);
  const [userId, setUserId]           = useState(null);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [copyMsg, setCopyMsg]         = useState('');

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUserId(session.user.id);
    await fetchWishlists(session.user.id);
  }

  const fetchWishlists = useCallback(async (uid) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          id, title, description, visibility, created_at,
          wishlist_items(count)
        `)
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) {
        // Table doesn't exist yet (code 42P01 = undefined_table)
        if (error.code === '42P01' || error.message?.includes('relation')) {
          setDbAvailable(false);
        }
        setWishlists([]);
      } else {
        setWishlists(data || []);
      }
    } catch (e) {
      console.error('fetchWishlists:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  async function createWishlist() {
    if (!newTitle.trim() || !userId) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('wishlists').insert({
        user_id:     userId,
        title:       newTitle.trim(),
        description: newDesc.trim() || null,
        visibility:  newVis,
      });
      if (error) throw error;
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewVis('public');
      await fetchWishlists(userId);
    } catch (e) {
      console.error('createWishlist:', e);
    } finally {
      setCreating(false);
    }
  }

  async function deleteWishlist(wl) {
    if (Platform.OS === 'web') {
      if (!window.confirm(`¿Eliminar "${wl.title}"? Esta acción no se puede deshacer.`)) return;
    } else {
      Alert.alert(
        'Eliminar lista',
        `¿Seguro que quieres eliminar "${wl.title}"?`,
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(wl.id) }]
      );
      return;
    }
    doDelete(wl.id);
  }

  async function doDelete(id) {
    await supabase.from('wishlists').delete().eq('id', id);
    setWishlists(prev => prev.filter(w => w.id !== id));
  }

  async function shareWishlist(wl) {
    const url = `https://giftly.app/wishlist/${wl.id}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopyMsg(`Link de "${wl.title}" copiado ✓`);
        setTimeout(() => setCopyMsg(''), 3000);
      } else {
        const { Share } = await import('react-native');
        await Share.share({ message: `Mira mi wishlist "${wl.title}" en Giftly: ${url}` });
      }
    } catch (e) {
      console.error('share:', e);
    }
  }

  function getItemCount(wl) {
    return wl.wishlist_items?.[0]?.count ?? 0;
  }

  function visibilityStyle(vis) {
    if (vis === 'public')  return { bg: colors.greenBg, text: colors.green };
    if (vis === 'friends') return { bg: colors.blueBg,  text: colors.blue };
    return { bg: colors.tagBg, text: colors.muted };
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Wishlists</Text>
        {dbAvailable && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.newBtnText}>+ Nueva</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toast */}
      {copyMsg ? (
        <View style={styles.toast}><Text style={styles.toastText}>{copyMsg}</Text></View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !dbAvailable ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupEmoji}>🗄</Text>
          <Text style={styles.setupTitle}>Configuración pendiente</Text>
          <Text style={styles.setupText}>
            Las wishlists nombradas requieren las tablas <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>wishlists</Text> y <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>wishlist_items</Text> en Supabase.{'\n\n'}
            Corre las migraciones SQL para activar esta función.
          </Text>
        </View>
      ) : wishlists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Todavía no tienes listas</Text>
          <Text style={styles.emptyText}>Crea tu primera wishlist y empieza a guardar productos que quieras recibir o comprar.</Text>
          <TouchableOpacity style={styles.createFirstBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.createFirstBtnText}>+ Crear mi primera lista</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {wishlists.map(wl => {
            const count = getItemCount(wl);
            const vs    = visibilityStyle(wl.visibility);
            return (
              <TouchableOpacity
                key={wl.id}
                style={styles.wlCard}
                onPress={() => navigation.navigate('WishlistDetail', { wishlistId: wl.id, title: wl.title })}
                activeOpacity={0.85}
              >
                <View style={styles.wlLeft}>
                  <Text style={styles.wlTitle}>{wl.title}</Text>
                  {wl.description ? (
                    <Text style={styles.wlDesc} numberOfLines={1}>{wl.description}</Text>
                  ) : null}
                  <View style={styles.wlMeta}>
                    <Text style={styles.wlCount}>{count} producto{count !== 1 ? 's' : ''}</Text>
                    <View style={[styles.wlVisBadge, { backgroundColor: vs.bg }]}>
                      <Text style={[styles.wlVisText, { color: vs.text }]}>
                        {VISIBILITY_OPTIONS.find(v => v.key === wl.visibility)?.label ?? wl.visibility}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.wlRight}>
                  <TouchableOpacity onPress={() => shareWishlist(wl)} style={styles.iconBtn}>
                    <Text style={styles.iconBtnText}>↗</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteWishlist(wl)} style={styles.iconBtn}>
                    <Text style={[styles.iconBtnText, { color: colors.accent }]}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCreate(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva wishlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre de la lista..."
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              maxLength={50}
              placeholderTextColor={colors.muted}
            />

            {/* Preset name chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {PRESET_NAMES.map(name => (
                <TouchableOpacity key={name} style={styles.presetChip} onPress={() => setNewTitle(name)}>
                  <Text style={styles.presetChipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Descripción opcional..."
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              maxLength={120}
              placeholderTextColor={colors.muted}
            />

            {/* Visibility */}
            <Text style={styles.sectionLabel}>Visibilidad</Text>
            <View style={styles.visRow}>
              {VISIBILITY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.visOption, newVis === opt.key && styles.visOptionActive]}
                  onPress={() => setNewVis(opt.key)}
                >
                  <Text style={[styles.visOptionText, newVis === opt.key && styles.visOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createBtn, (!newTitle.trim() || creating) && { opacity: 0.5 }]}
              onPress={createWishlist}
              disabled={!newTitle.trim() || creating}
            >
              {creating
                ? <ActivityIndicator color="white" />
                : <Text style={styles.createBtnText}>Crear lista →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },

  // Header
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:          { paddingRight: 12 },
  backText:         { fontSize: 22, color: colors.ink },
  title:            { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink },
  newBtn:           { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText:       { color: 'white', fontWeight: '700', fontSize: 13 },

  // Toast
  toast:            { margin: 16, backgroundColor: colors.ink, borderRadius: 12, padding: 13, alignItems: 'center' },
  toastText:        { color: 'white', fontWeight: '600', fontSize: 13 },

  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Setup banner
  setupBanner:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  setupEmoji:       { fontSize: 48, marginBottom: 16 },
  setupTitle:       { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  setupText:        { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  // Empty
  empty:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:        { fontSize: 52, marginBottom: 16 },
  emptyTitle:       { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptyText:        { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  createFirstBtn:   { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 14 },
  createFirstBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  // List
  listContainer:    { padding: 16, gap: 10 },
  wlCard:           { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  wlLeft:           { flex: 1 },
  wlTitle:          { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  wlDesc:           { fontSize: 12, color: colors.muted, marginBottom: 6 },
  wlMeta:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wlCount:          { fontSize: 12, color: colors.muted },
  wlVisBadge:       { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  wlVisText:        { fontSize: 11, fontWeight: '600' },
  wlRight:          { flexDirection: 'row', gap: 4, marginLeft: 12 },
  iconBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:      { fontSize: 16, fontWeight: '700', color: colors.ink },

  // Modal
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, margin: 12, gap: 12 },
  modalTitle:       { fontSize: 20, fontWeight: '700', color: colors.ink },
  input:            { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.ink },
  inputMulti:       { minHeight: 72, textAlignVertical: 'top' },
  presetRow:        { flexDirection: 'row', gap: 8 },
  presetChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.tagBg, borderWidth: 1, borderColor: colors.border },
  presetChipText:   { fontSize: 12, fontWeight: '500', color: colors.ink },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  visRow:           { flexDirection: 'row', gap: 8 },
  visOption:        { flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  visOptionActive:  { backgroundColor: colors.ink, borderColor: colors.ink },
  visOptionText:    { fontSize: 11, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  visOptionTextActive: { color: 'white' },
  createBtn:        { backgroundColor: colors.accent, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  createBtnText:    { color: 'white', fontWeight: '700', fontSize: 15 },
  cancelBtn:        { padding: 12, alignItems: 'center' },
  cancelBtnText:    { fontSize: 15, color: colors.muted },
});
