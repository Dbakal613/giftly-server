import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { DB_ERROR } from '../constants';
import { fetchWishlistItems, removeWishlistItem } from '../services/wishlists';
import { getById, formatPrice } from '../data/products';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WishlistDetailScreen({ route, navigation }) {
  const { wishlistId, title, readOnly = false } = route.params;
  const { toast, showToast } = useToast();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dbAvailable, setDbAvail] = useState(true);

  useEffect(() => { loadItems(); }, []);

  async function enrichItems(data) {
    const uuidIds = data
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

    return data.map(item => ({
      ...item,
      product: UUID_RE.test(item.product_id)
        ? (dbProds[item.product_id] || null)
        : (getById(item.product_id) || null),
    }));
  }

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchWishlistItems(wishlistId);

    if (error) {
      if (error.code === DB_ERROR.TABLE_NOT_FOUND || error.message?.includes('relation')) {
        setDbAvail(false);
      }
      setItems([]);
    } else {
      setItems(await enrichItems(data || []));
    }
    setLoading(false);
  }, [wishlistId]);

  async function handleRemove(itemId) {
    await removeWishlistItem(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function handleShare() {
    const url = `https://giftly.app/wishlist/${wishlistId}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado');
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
      <ScreenHeader
        title={title}
        onBack={() => navigation.goBack()}
        right={
          !readOnly ? (
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Feather name="share-2" size={17} color={colors.ink} />
            </TouchableOpacity>
          ) : null
        }
      />

      <Toast message={toast} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !dbAvailable ? (
        <EmptyState
          icon="database"
          title="Base de datos no configurada"
          text="Corre las migraciones SQL para activar wishlists."
          flex
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon="gift"
          title="Lista vacía"
          text="Explora productos y guárdalos en esta wishlist."
          cta={{ label: 'Explorar productos', onPress: () => navigation.navigate('Explore') }}
          flex
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.topBar}>
            <Text style={styles.countText}>
              {visibleItems.length} producto{visibleItems.length !== 1 ? 's' : ''}
            </Text>
            {!readOnly && (
              <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Explore')}>
                <Feather name="plus" size={13} color="white" />
                <Text style={styles.addBtnText}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>

          {visibleItems.map(item => <ItemCard key={item.id} item={item} onRemove={handleRemove} readOnly={readOnly} onPress={() => navigation.navigate('Product', { product: item.product })} />)}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function ItemCard({ item, onPress, onRemove, readOnly }) {
  const p = item.product;
  const price = p.price
    ? (typeof p.currency !== 'undefined'
        ? formatPrice(p.price, p.currency)
        : `$${Math.round(p.price).toLocaleString('es-CL')}`)
    : null;

  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.itemImg}>
        {p.image_url
          ? <Image source={{ uri: p.image_url }} style={styles.itemImgPhoto} resizeMode="contain" />
          : <Feather name="package" size={30} color={colors.muted} />
        }
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemBrand} numberOfLines={1}>{p.brand || p.store}</Text>
        <Text style={styles.itemName} numberOfLines={2}>{p.name}</Text>
        {price ? <Text style={styles.itemPrice}>{price}</Text> : null}
        {item.note ? <Text style={styles.itemNote} numberOfLines={1}>{item.note}</Text> : null}
      </View>
      {!readOnly && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={16} color={colors.muted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shareBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  scroll:    { padding: 16 },
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  countText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  itemCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm },
  itemImg:     { width: 88, height: 88, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  itemImgPhoto: { width: 88, height: 88 },
  itemInfo:    { flex: 1, padding: 12 },
  itemBrand:   { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  itemName:    { fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 19, marginBottom: 5 },
  itemPrice:   { fontSize: 16, fontWeight: '800', color: colors.accent },
  itemNote:    { fontSize: 11, color: colors.muted, marginTop: 4, fontStyle: 'italic' },
  removeBtn:   { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
