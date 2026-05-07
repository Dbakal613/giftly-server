import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Dimensions
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, text } from '../lib/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const LISTS = [
  { key: 'want_to_buy',   label: 'Quiero comprar', short: 'Quiero',     icon: '🛍️', color: colors.accent, bg: colors.redBg },
  { key: 'bought',        label: 'Compré',          short: 'Compré',     icon: '✅', color: colors.green,  bg: colors.greenBg },
  { key: 'recommend',     label: 'Recomiendo',      short: 'Recomiendo', icon: '👍', color: colors.blue,   bg: colors.blueBg },
  { key: 'not_recommend', label: 'No recomiendo',   short: 'No rec.',    icon: '👎', color: colors.muted,  bg: colors.tagBg },
];

export default function HomeScreen({ navigation }) {
  const [activeList, setActiveList] = useState('want_to_buy');
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile]       = useState(null);
  const [counts, setCounts]         = useState({});
  const [groupGifts, setGroupGifts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId]         = useState(null);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (userId) fetchItems(); }, [activeList, userId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);
    fetchCounts(user.id);
    fetchGroupGifts(user.id);
    fetchUnread(user.id);

    // Realtime badge
    const channel = supabase
      .channel('notifs_' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchUnread(user.id))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function fetchUnread(uid) {
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('is_read', false);
    setUnreadCount(count || 0);
  }

  async function fetchCounts(uid) {
    const newCounts = {};
    for (const list of LISTS) {
      const { count } = await supabase.from('list_items')
        .select('*', { count: 'exact', head: true })
        .eq('list_type', list.key).eq('user_id', uid);
      newCounts[list.key] = count || 0;
    }
    setCounts(newCounts);
  }

  async function fetchGroupGifts(uid) {
    const { data } = await supabase.from('group_gifts')
      .select('*, products(name, image_emoji, image_url, price), group_gift_members(amount, status)')
      .eq('creator_id', uid).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(3);
    setGroupGifts(data || []);
  }

  async function fetchItems() {
    setLoading(true);
    try {
      const { data } = await supabase.from('list_items')
        .select('id, list_type, added_at, products(id, name, brand, category, image_emoji, image_url, price, store)')
        .eq('list_type', activeList).eq('user_id', userId)
        .order('added_at', { ascending: false });
      setItems(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function removeItem(itemId) {
    await supabase.from('list_items').delete().eq('id', itemId);
    fetchItems();
    fetchCounts(userId);
  }

  function getGiftProgress(gift) {
    const members = gift.group_gift_members || [];
    const paid = members.filter(m => m.status === 'paid').reduce((sum, m) => sum + (m.amount || 0), 0);
    const total = gift.products?.price || 0;
    return { paid, total, pct: total > 0 ? Math.min((paid / total) * 100, 100) : 0 };
  }

  const activeListData = LISTS.find(l => l.key === activeList);
  const firstName = profile?.name || profile?.username || '';

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          {firstName ? <Text style={styles.greeting}>Hola, {firstName} 👋</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); fetchGroupGifts(userId); fetchCounts(userId); }} tintColor={colors.accent} />}
      >
        {/* ── List tabs ── */}
        <View style={styles.tabsRow}>
          {LISTS.map(list => (
            <TouchableOpacity
              key={list.key}
              style={[styles.tab, activeList === list.key && { backgroundColor: list.bg, borderColor: list.color }]}
              onPress={() => setActiveList(list.key)}
            >
              <Text style={styles.tabIcon}>{list.icon}</Text>
              <Text style={[styles.tabCount, { color: list.color }]}>{counts[list.key] || 0}</Text>
              <Text style={[styles.tabLabel, { color: activeList === list.key ? list.color : colors.muted }]}>{list.short}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Search shortcut ── */}
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Buscar en Falabella, Ripley, Paris...</Text>
        </TouchableOpacity>

        {/* ── Group gifts ── */}
        {groupGifts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎁 Regalos grupales</Text>
              <TouchableOpacity onPress={() => navigation.navigate('GroupGift', {})}>
                <Text style={styles.sectionLink}>+ Nuevo</Text>
              </TouchableOpacity>
            </View>
            {groupGifts.map(gift => {
              const { paid, total, pct } = getGiftProgress(gift);
              return (
                <TouchableOpacity key={gift.id} style={styles.giftCard} onPress={() => navigation.navigate('GroupGift', { gift })}>
                  <View style={styles.giftTop}>
                    <View style={styles.giftEmoji}>
                      <Text style={{ fontSize: 22 }}>{gift.products?.image_emoji || '🎁'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.giftName} numberOfLines={1}>{gift.products?.name || 'Regalo'}</Text>
                      <Text style={styles.giftFor}>Para {gift.recipient_name} · {gift.occasion}</Text>
                    </View>
                    <View style={styles.giftPctBadge}>
                      <Text style={styles.giftPctText}>{Math.round(pct)}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.giftPaid}>${paid.toLocaleString('es-CL')} reunidos</Text>
                    <Text style={styles.giftTotal}>de ${total.toLocaleString('es-CL')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Product list ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{activeListData.icon} {activeListData.label}</Text>
            <Text style={styles.sectionCount}>{items.length} productos</Text>
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{activeListData.icon}</Text>
              <Text style={styles.emptyTitle}>Lista vacía</Text>
              <Text style={styles.emptyText}>Busca productos y agrégalos aquí</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: activeListData.color }]} onPress={() => navigation.navigate('Search')}>
                <Text style={styles.emptyBtnText}>+ Buscar productos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('Product', { product: item.products })}
                  activeOpacity={0.8}
                >
                  {/* Image */}
                  <View style={styles.cardImg}>
                    {item.products?.image_url ? (
                      <Image source={{ uri: item.products.image_url }} style={styles.cardImgPhoto} resizeMode="contain" />
                    ) : (
                      <Text style={styles.cardEmoji}>{item.products?.image_emoji || '📦'}</Text>
                    )}
                  </View>
                  {/* Info */}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardStore} numberOfLines={1}>{item.products?.brand || item.products?.store}</Text>
                    <Text style={styles.cardName} numberOfLines={2}>{item.products?.name}</Text>
                    <Text style={[styles.cardPrice, { color: activeListData.color }]}>
                      ${item.products?.price?.toLocaleString('es-CL')}
                    </Text>
                  </View>
                  {/* Remove */}
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Bottom nav ── */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'Inicio',  screen: null,      active: true },
          { icon: '🔍', label: 'Buscar',  screen: 'Search' },
          { icon: '👥', label: 'Amigos',  screen: 'Friends' },
          { icon: '👤', label: 'Perfil',  screen: 'Profile' },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => item.screen && navigation.navigate(item.screen)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo:            { fontSize: 28, fontWeight: '800', color: colors.accent, letterSpacing: -1 },
  logoBlack:       { color: colors.ink },
  greeting:        { fontSize: 13, color: colors.muted, marginTop: 1 },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:     { fontSize: 17 },
  badge:           { position: 'absolute', top: -2, right: -2, backgroundColor: colors.accent, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:       { color: 'white', fontSize: 9, fontWeight: '700' },
  avatar:          { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { color: 'white', fontWeight: '700', fontSize: 15 },

  // Tabs
  tabsRow:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:             { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.tagBg },
  tabIcon:         { fontSize: 18 },
  tabCount:        { fontSize: 20, fontWeight: '800' },
  tabLabel:        { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Search bar
  searchBar:       { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: colors.border, ...shadow.sm },
  searchIcon:      { fontSize: 16 },
  searchPlaceholder: { fontSize: 14, color: colors.muted },

  // Sections
  section:         { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: colors.ink },
  sectionLink:     { fontSize: 13, color: colors.accent, fontWeight: '600' },
  sectionCount:    { fontSize: 13, color: colors.muted },

  // Group gifts
  giftCard:        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  giftTop:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  giftEmoji:       { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.redBg, alignItems: 'center', justifyContent: 'center' },
  giftName:        { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  giftFor:         { fontSize: 12, color: colors.muted },
  giftPctBadge:    { backgroundColor: colors.redBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  giftPctText:     { fontSize: 13, fontWeight: '700', color: colors.accent },
  progressBg:      { height: 5, backgroundColor: colors.tagBg, borderRadius: 100, overflow: 'hidden', marginBottom: 8 },
  progressFill:    { height: '100%', backgroundColor: colors.green, borderRadius: 100 },
  giftPaid:        { fontSize: 12, fontWeight: '600', color: colors.green },
  giftTotal:       { fontSize: 12, color: colors.muted },

  // Grid
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:            { width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  cardImg:         { width: '100%', aspectRatio: 1, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  cardImgPhoto:    { width: '100%', height: '100%' },
  cardEmoji:       { fontSize: 52 },
  cardBody:        { padding: 12 },
  cardStore:       { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  cardName:        { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6, lineHeight: 18 },
  cardPrice:       { fontSize: 17, fontWeight: '800' },
  removeBtn:       { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  removeBtnText:   { color: 'white', fontSize: 11, fontWeight: '700' },

  // Empty
  center:          { padding: 40, alignItems: 'center' },
  empty:           { alignItems: 'center', padding: 32 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyText:       { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  emptyBtn:        { borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:    { color: 'white', fontWeight: '600', fontSize: 14 },

  // Bottom nav
  bottomNav:       { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 28, paddingTop: 10 },
  navItem:         { flex: 1, alignItems: 'center', gap: 2 },
  navIcon:         { fontSize: 22 },
  navLabel:        { fontSize: 10, color: colors.muted, fontWeight: '500' },
  navLabelActive:  { color: colors.accent, fontWeight: '700' },
});
