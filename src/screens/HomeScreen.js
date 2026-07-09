import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Platform,
  Modal, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { VISIBILITY_OPTIONS, PRESET_WISHLIST_NAMES, DB_ERROR, visibilityColor, visibilityIcon } from '../constants';
import { getCurrentSession } from '../services/auth';
import { fetchUserWishlists, createWishlist } from '../services/wishlists';
import { fetchProfile, fetchUnreadCount } from '../services/profiles';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';

export default function HomeScreen({ navigation }) {
  const [profile, setProfile]         = useState(null);
  const [wishlists, setWishlists]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId]           = useState(null);
  const [dbReady, setDbReady]         = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newVis, setNewVis]         = useState('public');
  const [creating, setCreating]     = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const session = await getCurrentSession();
    if (!session?.user) return;
    const uid = session.user.id;
    setUserId(uid);

    const [{ data: prof }] = await Promise.all([
      fetchProfile(uid, 'id, name, username, avatar_url'),
      loadWishlists(uid),
      loadUnread(uid),
    ]);
    setProfile(prof);

    const channel = supabase
      .channel('notifs_' + uid)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'notifications', filter: `user_id=eq.${uid}`,
      }, () => loadUnread(uid))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  async function loadUnread(uid) {
    setUnreadCount(await fetchUnreadCount(uid));
  }

  async function loadWishlists(uid) {
    const id = uid || userId;
    if (!id) return;
    setLoading(true);
    const { data, error } = await fetchUserWishlists(id);
    if (error) {
      if (error.code === DB_ERROR.TABLE_NOT_FOUND || error.message?.includes('relation')) {
        setDbReady(false);
      }
      setWishlists([]);
    } else {
      setWishlists(data || []);
    }
    setLoading(false);
    setRefreshing(false);
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

  const firstName = profile?.name || profile?.username || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          {firstName ? <Text style={styles.greeting}>Hola, {firstName}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
            <Feather name="bell" size={19} color={colors.ink} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url.startsWith('data:') ? profile.avatar_url : profile.avatar_url + (Platform.OS === 'web' ? `?t=${Date.now() % 10000}` : '') }}
                style={styles.avatarPhoto}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadWishlists(); }}
            tintColor={colors.accent}
          />
        }
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('Explore')}
          style={styles.exploreBanner}
          activeOpacity={0.88}
        >
          <View style={styles.exploreBannerIcon}>
            <Feather name="compass" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.exploreBannerTitle}>Explorar productos</Text>
            <Text style={styles.exploreBannerSub}>Bubba · Launge · Froens · Wild Lama y más</Text>
          </View>
          <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Recommendations')}
          style={styles.recsBanner}
          activeOpacity={0.88}
        >
          <View style={styles.recsBannerIcon}>
            <Feather name="zap" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recsBannerTitle}>Recomendaciones para ti</Text>
            <Text style={styles.recsBannerSub}>Basadas en tus intereses y preferencias</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis wishlists</Text>
            {dbReady && (
              <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
                <Feather name="plus" size={13} color="white" />
                <Text style={styles.newBtnText}>Nueva</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
          ) : !dbReady ? (
            <EmptyState
              icon="database"
              title="Base de datos no configurada"
              text="Corre las migraciones SQL para activar wishlists."
            />
          ) : wishlists.length === 0 ? (
            <EmptyState
              icon="list"
              title="Todavía no tienes listas"
              text="Crea tu primera wishlist y empieza a guardar productos."
              cta={{ label: 'Crear mi primera lista', onPress: () => setShowCreate(true) }}
            />
          ) : (
            <View style={styles.wlList}>
              {wishlists.map(wl => <WishlistCard key={wl.id} wl={wl} onPress={() => navigation.navigate('WishlistDetail', { wishlistId: wl.id, title: wl.title })} />)}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <BottomNav navigation={navigation} active="Home" />

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
                  <Text style={styles.presetText}>{name}</Text>
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

function WishlistCard({ wl, onPress }) {
  const count = wl.wishlist_items?.[0]?.count ?? 0;
  const vc    = visibilityColor(wl.visibility);
  const visOpt = VISIBILITY_OPTIONS.find(v => v.key === wl.visibility);

  return (
    <TouchableOpacity style={styles.wlCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.wlIconWrap}>
        <Feather name="list" size={18} color={colors.accent} />
      </View>
      <View style={styles.wlInfo}>
        <Text style={styles.wlTitle}>{wl.title}</Text>
        <Text style={styles.wlMeta}>{count} producto{count !== 1 ? 's' : ''}</Text>
      </View>
      <View style={[styles.visBadge, { backgroundColor: vc.bg }]}>
        <Feather name={visibilityIcon(wl.visibility)} size={9} color={vc.fg} />
        <Text style={[styles.visText, { color: vc.fg }]}>{visOpt?.label ?? wl.visibility}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo:         { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  logoBlack:    { color: colors.ink },
  greeting:     { fontSize: 13, color: colors.muted, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  badge:        { position: 'absolute', top: -2, right: -2, backgroundColor: colors.accent, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:    { color: 'white', fontSize: 9, fontWeight: '700' },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: 'white', fontWeight: '700', fontSize: 15 },
  avatarPhoto:  { width: 38, height: 38, borderRadius: 19 },

  exploreBanner:      { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, marginBottom: 8, backgroundColor: colors.ink, borderRadius: radius.lg, padding: 18 },
  exploreBannerIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  exploreBannerTitle: { fontSize: 15, fontWeight: '700', color: 'white', marginBottom: 3 },
  exploreBannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  recsBanner:         { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  recsBannerIcon:     { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  recsBannerTitle:    { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  recsBannerSub:      { fontSize: 12, color: colors.muted },

  section:       { paddingHorizontal: 16, paddingTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  newBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText:    { color: 'white', fontWeight: '700', fontSize: 13 },

  wlList:        { gap: 10 },
  wlCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  wlIconWrap:    { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  wlInfo:        { flex: 1 },
  wlTitle:       { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  wlMeta:        { fontSize: 12, color: colors.muted },
  visBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4, marginRight: 8 },
  visText:       { fontSize: 10, fontWeight: '600' },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingTop: 16, gap: 12 },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle:    { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  input:         { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.ink, backgroundColor: colors.bg },
  presetRow:     { flexDirection: 'row', gap: 8 },
  presetChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.tagBg, borderWidth: 1, borderColor: colors.border },
  presetText:    { fontSize: 12, fontWeight: '500', color: colors.ink },
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
