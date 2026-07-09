import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { VISIBILITY_OPTIONS, PRESET_WISHLIST_NAMES, DB_ERROR, visibilityColor, visibilityIcon } from '../constants';
import { getCurrentSession } from '../services/auth';
import { fetchUserWishlists, createWishlist, deleteWishlist } from '../services/wishlists';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

export default function WishlistsScreen({ navigation }) {
  const { toast, showToast } = useToast();
  const [wishlists, setWishlists]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newVis, setNewVis]         = useState('public');
  const [creating, setCreating]     = useState(false);
  const [userId, setUserId]         = useState(null);
  const [dbReady, setDbReady]       = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const session = await getCurrentSession();
    if (!session?.user) return;
    setUserId(session.user.id);
    await loadWishlists(session.user.id);
  }

  async function loadWishlists(uid) {
    setLoading(true);
    const { data, error } = await fetchUserWishlists(uid);
    if (error) {
      if (error.code === DB_ERROR.TABLE_NOT_FOUND || error.message?.includes('relation')) {
        setDbReady(false);
      }
      setWishlists([]);
    } else {
      setWishlists(data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTitle.trim() || !userId) return;
    setCreating(true);
    const { error } = await createWishlist({ userId, title: newTitle.trim(), visibility: newVis });
    if (!error) {
      setShowCreate(false);
      setNewTitle('');
      setNewVis('public');
      await loadWishlists(userId);
    }
    setCreating(false);
  }

  async function handleDelete(wl) {
    const doDelete = async () => {
      await deleteWishlist(wl.id);
      setWishlists(prev => prev.filter(w => w.id !== wl.id));
    };
    if (Platform.OS === 'web') {
      if (!window.confirm(`¿Eliminar "${wl.title}"?`)) return;
      doDelete();
    } else {
      Alert.alert('Eliminar lista', `¿Seguro que quieres eliminar "${wl.title}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  async function handleShare(wl) {
    const url = `https://giftly.app/wishlist/${wl.id}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado');
      } else {
        const { Share } = await import('react-native');
        await Share.share({ message: `Mira mi wishlist "${wl.title}" en Giftly: ${url}` });
      }
    } catch (e) {
      console.error('share:', e);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Mis wishlists"
        onBack={() => navigation.goBack()}
        right={
          dbReady ? (
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
              <Feather name="plus" size={13} color="white" />
              <Text style={styles.newBtnText}>Nueva</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <Toast message={toast} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !dbReady ? (
        <EmptyState
          icon="database"
          title="Base de datos no configurada"
          text="Corre las migraciones SQL para activar wishlists."
          flex
        />
      ) : wishlists.length === 0 ? (
        <EmptyState
          icon="list"
          title="Todavía no tienes listas"
          text="Crea tu primera wishlist y empieza a guardar productos."
          cta={{ label: 'Crear mi primera lista', onPress: () => setShowCreate(true) }}
          flex
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {wishlists.map(wl => (
            <WishlistRow
              key={wl.id}
              wl={wl}
              onPress={() => navigation.navigate('WishlistDetail', { wishlistId: wl.id, title: wl.title })}
              onShare={() => handleShare(wl)}
              onDelete={() => handleDelete(wl)}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCreate(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nueva wishlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre de la lista..."
              placeholderTextColor={colors.muted}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              maxLength={50}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {PRESET_WISHLIST_NAMES.map(name => (
                <TouchableOpacity key={name} style={styles.presetChip} onPress={() => setNewTitle(name)}>
                  <Text style={styles.presetChipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.visLabel}>Visibilidad</Text>
            <View style={styles.visRow}>
              {VISIBILITY_OPTIONS.map(opt => {
                const active = newVis === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.visOpt, active && styles.visOptActive]}
                    onPress={() => setNewVis(opt.key)}
                  >
                    <Feather name={opt.icon} size={13} color={active ? 'white' : colors.muted} />
                    <Text style={[styles.visOptText, active && styles.visOptTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.createBtn, (!newTitle.trim() || creating) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
            >
              {creating
                ? <ActivityIndicator color="white" />
                : <Text style={styles.createBtnText}>Crear lista</Text>}
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

function WishlistRow({ wl, onPress, onShare, onDelete }) {
  const count  = wl.wishlist_items?.[0]?.count ?? 0;
  const vc     = visibilityColor(wl.visibility);
  const visOpt = VISIBILITY_OPTIONS.find(v => v.key === wl.visibility);

  return (
    <TouchableOpacity style={styles.wlCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.wlIconWrap}>
        <Feather name="list" size={18} color={colors.accent} />
      </View>
      <View style={styles.wlInfo}>
        <Text style={styles.wlTitle}>{wl.title}</Text>
        <View style={styles.wlMeta}>
          <Text style={styles.wlCount}>{count} producto{count !== 1 ? 's' : ''}</Text>
          <View style={[styles.visBadge, { backgroundColor: vc.bg }]}>
            <Feather name={visibilityIcon(wl.visibility)} size={9} color={vc.fg} />
            <Text style={[styles.visText, { color: vc.fg }]}>{visOpt?.label ?? wl.visibility}</Text>
          </View>
        </View>
      </View>
      <View style={styles.wlActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onShare}>
          <Feather name="share-2" size={15} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onDelete}>
          <Feather name="trash-2" size={15} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText:   { color: 'white', fontWeight: '700', fontSize: 13 },

  listContainer: { padding: 16, gap: 10 },
  wlCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  wlIconWrap:    { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  wlInfo:        { flex: 1 },
  wlTitle:       { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  wlMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wlCount:       { fontSize: 12, color: colors.muted },
  visBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  visText:       { fontSize: 10, fontWeight: '600' },
  wlActions:     { flexDirection: 'row', gap: 6, marginLeft: 8 },
  iconBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingTop: 16, gap: 12 },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle:    { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  input:         { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.ink, backgroundColor: colors.bg },
  presetRow:     { flexDirection: 'row', gap: 8 },
  presetChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.tagBg, borderWidth: 1, borderColor: colors.border },
  presetChipText: { fontSize: 12, fontWeight: '500', color: colors.ink },
  visLabel:      { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  visRow:        { flexDirection: 'row', gap: 8 },
  visOpt:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.tagBg, borderWidth: 1.5, borderColor: 'transparent' },
  visOptActive:  { backgroundColor: colors.ink, borderColor: colors.ink },
  visOptText:    { fontSize: 12, fontWeight: '600', color: colors.ink },
  visOptTextActive: { color: 'white' },
  createBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  createBtnText: { color: 'white', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  btnDisabled:   { opacity: 0.45 },
  cancelBtn:     { padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: colors.muted },
});
