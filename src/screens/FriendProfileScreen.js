import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';

const LISTS = [
  { key: 'want_to_buy',   label: 'Quiere comprar', icon: '🛍️', color: '#D94F3D', bg: '#FDE8E5' },
  { key: 'bought',        label: 'Compró',         icon: '✅', color: '#2D8C5E', bg: '#DCF5EB' },
  { key: 'recommend',     label: 'Recomienda',     icon: '👍', color: '#3D7DD9', bg: '#E8F0FE' },
  { key: 'not_recommend', label: 'No recomienda',  icon: '👎', color: '#8A8A82', bg: '#F0EFE8' },
];

export default function FriendProfileScreen({ route, navigation }) {
  const { profile } = route.params;
  const [activeList, setActiveList]   = useState('want_to_buy');
  const [items, setItems]             = useState([]);
  const [counts, setCounts]           = useState({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => { fetchCounts(); }, []);
  useEffect(() => { fetchItems(); }, [activeList]);

  async function fetchCounts() {
    const newCounts = {};
    for (const list of LISTS) {
      const { count } = await supabase
        .from('list_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('list_type', list.key);
      newCounts[list.key] = count || 0;
    }
    setCounts(newCounts);
  }

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from('list_items')
      .select('id, list_type, added_at, products(id, name, brand, category, image_emoji, image_url, price, store)')
      .eq('user_id', profile.id)
      .eq('list_type', activeList)
      .order('added_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  const activeListData = LISTS.find(l => l.key === activeList);
  const displayName = profile.name || profile.username || 'Usuario';

  return (
    <View style={styles.container}>
      {/* Dark header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.profileTop}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileHandle}>@{profile.username || 'usuario'}</Text>
            <View style={styles.statsRow}>
              {LISTS.map(l => (
                <View key={l.key} style={styles.stat}>
                  <Text style={styles.statN}>{counts[l.key] || 0}</Text>
                  <Text style={styles.statL}>{l.icon}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* List tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {LISTS.map(list => (
          <TouchableOpacity
            key={list.key}
            style={[styles.tab, activeList === list.key && { borderBottomColor: list.color, borderBottomWidth: 2 }]}
            onPress={() => setActiveList(list.key)}
          >
            <Text style={[styles.tabText, activeList === list.key && { color: list.color, fontWeight: '600' }]}>
              {list.icon} {list.label}
            </Text>
            {counts[list.key] > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: list.bg }]}>
                <Text style={[styles.tabBadgeText, { color: list.color }]}>{counts[list.key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D94F3D" /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{activeListData.icon}</Text>
          <Text style={styles.emptyTitle}>Lista vacía</Text>
          <Text style={styles.emptyText}>{displayName} no tiene productos aquí aún</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.productList} showsVerticalScrollIndicator={false}>
          {items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.productCard}
              onPress={() => navigation.navigate('Product', { product: item.products })}
              activeOpacity={0.75}
            >
              <View style={styles.productImgWrap}>
                {item.products?.image_url ? (
                  <Image source={{ uri: item.products.image_url }} style={styles.productImg} resizeMode="contain" />
                ) : (
                  <Text style={styles.productEmoji}>{item.products?.image_emoji || '📦'}</Text>
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productBrand}>{item.products?.brand} · {item.products?.store}</Text>
                <Text style={styles.productName} numberOfLines={1}>{item.products?.name}</Text>
                <Text style={[styles.productPrice, { color: activeListData.color }]}>
                  ${item.products?.price?.toLocaleString('es-CL')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.giftBtn}
                onPress={() => navigation.navigate('GroupGift', { product: item.products })}
              >
                <Text>🎁</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#FAFAF7' },
  profileHeader:  { backgroundColor: '#1A1A18', paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  backBtn:        { marginBottom: 20 },
  backText:       { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  profileTop:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarLg:       { width: 68, height: 68, borderRadius: 34, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  avatarLgText:   { color: 'white', fontSize: 26, fontWeight: '700' },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 22, fontWeight: '700', color: 'white', marginBottom: 2 },
  profileHandle:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  statsRow:       { flexDirection: 'row', gap: 16 },
  stat:           { alignItems: 'center' },
  statN:          { fontSize: 18, fontWeight: '700', color: 'white' },
  statL:          { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  tabsScroll:     { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2', flexGrow: 0 },
  tabsContent:    { paddingHorizontal: 8 },
  tab:            { paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:        { fontSize: 13, color: '#8A8A82' },
  tabBadge:       { borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeText:   { fontSize: 11, fontWeight: '700' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#1A1A18', marginBottom: 6 },
  emptyText:      { fontSize: 14, color: '#8A8A82', textAlign: 'center' },
  productList:    { padding: 16, gap: 10 },
  productCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E8E8E2' },
  productImgWrap: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  productImg:     { width: 54, height: 54 },
  productEmoji:   { fontSize: 26 },
  productInfo:    { flex: 1, minWidth: 0 },
  productBrand:   { fontSize: 10, color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  productName:    { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 4 },
  productPrice:   { fontSize: 16, fontWeight: '700' },
  giftBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center' },
});
