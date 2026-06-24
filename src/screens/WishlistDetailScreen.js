import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getById, formatPrice } from '../data/products';
import { colors, radius, shadow } from '../lib/theme';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WishlistDetailScreen({ route, navigation }) {
  const { wishlistId, title } = route.params;
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dbAvailable, setDbAvail] = useState(true);
  const [toast, setToast]         = useState('');

  useEffect(() => { fetchItems(); }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('id, product_id, note, status, created_at')
        .eq('wishlist_id', wishlistId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation')) setDbAvail(false);
        setItems([]);
        return;
      }

      // Resolve product details: UUID → DB, string → mock catalog
      const uuidIds = (data || [])
        .filter(i => UUID_RE.test(i.product_id))
        .map(i => i.product_id);

      let dbProds = {};
      if (uuidIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, brand, category, image_emoji, image_url, price, store, external_url, permalink')
          .in('id', uuidIds);
        for (const p of (prods || [])) dbProds[p.id] = p;
      }

      setItems(
        (data || []).map(item => ({
          ...item,
          product: UUID_RE.test(item.product_id)
            ? (dbProds[item.product_id] || null)
            : (getById(item.product_id) || null),
        }))
      );
    } catch (e) {
      console.error('WishlistDetail fetchItems:', e);
    } finally {
      setLoading(false);
    }
  }, [wishlistId]);

  async function removeItem(itemId) {
    await supabase.from('wishlist_items').delete().eq('id', itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function share() {
    const url = `https://giftly.app/wishlist/${wishlistId}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado ✓');
      } else {
        const { Share } = await import('react-native');
        await Share.share({ message: `Mira mi wishlist "${title}" en Giftly: ${url}` });
      }
    } catch (e) {
      console.error('share:', e);
    }
  }

  const visibleItems = items.filter(i => i.product);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={share} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      {toast ? (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !dbAvailable ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗄</Text>
          <Text style={styles.emptyTitle}>Base de datos no configurada</Text>
          <Text style={styles.emptyText}>Corre las migraciones SQL para activar wishlists.</Text>
        </View>
      ) : visibleItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎁</Text>
          <Text style={styles.emptyTitle}>Lista vacía</Text>
          <Text style={styles.emptyText}>Explora productos y guárdalos en esta wishlist.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('Explore')}>
            <Text style={styles.exploreBtnText}>✨ Explorar productos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.countText}>{visibleItems.length} producto{visibleItems.length !== 1 ? 's' : ''}</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Explore')}>
              <Text style={styles.addBtnText}>＋ Agregar</Text>
            </TouchableOpacity>
          </View>

          {/* Item list */}
          {visibleItems.map(item => {
            const p = item.product;
            const price = p.price
              ? (typeof p.currency !== 'undefined' ? formatPrice(p.price, p.currency) : `$${Math.round(p.price).toLocaleString('es-CL')}`)
              : null;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => navigation.navigate('Product', { product: p })}
                activeOpacity={0.85}
              >
                <View style={styles.itemImg}>
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.itemImgPhoto} resizeMode="contain" />
                  ) : (
                    <Text style={styles.itemEmoji}>{p.image_emoji || '📦'}</Text>
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemBrand} numberOfLines={1}>{p.brand || p.store}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{p.name}</Text>
                  {price ? <Text style={styles.itemPrice}>{price}</Text> : null}
                  {item.note ? <Text style={styles.itemNote} numberOfLines={1}>{item.note}</Text> : null}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },

  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:        { padding: 4 },
  backText:       { fontSize: 22, color: colors.ink },
  headerTitle:    { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  shareBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  shareBtnText:   { fontSize: 16, fontWeight: '700', color: colors.ink },

  toast:          { margin: 16, backgroundColor: colors.ink, borderRadius: 12, padding: 13, alignItems: 'center' },
  toastText:      { color: 'white', fontWeight: '600', fontSize: 13 },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:      { fontSize: 52, marginBottom: 16 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptyText:      { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exploreBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 14 },
  exploreBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  scroll:         { padding: 16 },

  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  countText:      { fontSize: 13, color: colors.muted, fontWeight: '500' },
  addBtn:         { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:     { color: 'white', fontWeight: '700', fontSize: 13 },

  itemCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm },
  itemImg:        { width: 88, height: 88, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  itemImgPhoto:   { width: 88, height: 88 },
  itemEmoji:      { fontSize: 38 },
  itemInfo:       { flex: 1, padding: 12 },
  itemBrand:      { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  itemName:       { fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 19, marginBottom: 5 },
  itemPrice:      { fontSize: 16, fontWeight: '800', color: colors.accent },
  itemNote:       { fontSize: 11, color: colors.muted, marginTop: 4, fontStyle: 'italic' },
  removeBtn:      { width: 40, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  removeBtnText:  { fontSize: 14, color: colors.muted, fontWeight: '700' },
});
