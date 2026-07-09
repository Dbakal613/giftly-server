import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Image, ScrollView, Dimensions, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { SERVER_URL } from '../lib/config';
import { colors, radius } from '../lib/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

// ── Store branding ────────────────────────────────────────────────────────────
const STORE = {
  MercadoLibre: { color: '#E8A020', bg: '#FFF8E6', label: 'MercadoLibre' },
  Amazon:        { color: '#FF9900', bg: '#FFF4E6', label: 'Amazon' },
  Falabella:    { color: '#1E6FCC', bg: '#E8F0FF', label: 'Falabella' },
  Paris:        { color: '#1B7A42', bg: '#E6F5EC', label: 'Paris' },
  Ripley:       { color: '#C0392B', bg: '#FDEAE8', label: 'Ripley' },
};

function storeStyle(source) {
  return STORE[source] || { color: colors.muted, bg: colors.tagBg, label: source };
}

// ── Category browsing ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Todo',        slugs: ['smartphones', 'fragrances', 'mens-shoes'] },
  { label: 'Tecnología',  slugs: ['smartphones', 'laptops', 'tablets'] },
  { label: 'Moda',        slugs: ['mens-shoes', 'womens-shoes', 'mens-shirts'] },
  { label: 'Hogar',       slugs: ['kitchen-accessories', 'furniture', 'home-decoration'] },
  { label: 'Deportes',    slugs: ['sports-accessories', 'mens-watches'] },
  { label: 'Belleza',     slugs: ['fragrances', 'skin-care', 'beauty'] },
  { label: 'Accesorios',  slugs: ['sunglasses', 'mobile-accessories', 'womens-jewellery'] },
];

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchMultiRetailer(q, limit = 20) {
  const res = await axios.get(`${SERVER_URL}/search`, {
    params: { q, limit },
    timeout: 15000,
  });
  return res.data?.results || [];
}

function mapDummy(item) {
  return {
    externalId:    `d${item.id}`,
    source:        'MercadoLibre',
    name:          item.title,
    price:         Math.round(item.price * 950),
    originalPrice: item.discountPercentage > 5
      ? Math.round(item.price * 950 / (1 - item.discountPercentage / 100))
      : null,
    imageUrl:      item.thumbnail || null,
    permalink:     null,
    brand:         item.brand || '',
    currency:      'CLP',
  };
}

async function fetchByCategory(slug, limit = 10) {
  try {
    const { data } = await axios.get(`https://dummyjson.com/products/category/${slug}`, {
      params: { limit },
      timeout: 8000,
    });
    return (data.products || []).map(mapDummy).filter(p => p.name && p.price > 0);
  } catch (e) {
    console.error('fetchByCategory error:', slug, e.message);
    return [];
  }
}

async function fetchML(q, limit = 10) {
  try {
    const { data } = await axios.get('https://dummyjson.com/products/search', {
      params: { q, limit },
      timeout: 8000,
    });
    return (data.products || []).map(mapDummy).filter(p => p.name && p.price > 0);
  } catch (e) {
    console.error('fetchML error:', e.message);
    return [];
  }
}

function itemKey(item) {
  if (item.externalId) return `${item.source}_${item.externalId}`;
  if (item.mlId)       return `MercadoLibre_${item.mlId}`;
  return `${item.source || 'x'}_${item.name}`;
}

function toProductShape(item) {
  return {
    name:        item.name,
    brand:       item.brand || '',
    store:       item.source || item.store || 'MercadoLibre',
    price:       item.price,
    currency:    item.currency || 'CLP',
    image_url:   item.imageUrl || item.image_url || null,
    image_emoji: '',
    category:    item.category || '',
    permalink:   item.permalink || null,
  };
}

// ── Grouping ──────────────────────────────────────────────────────────────────
const STOP = new Set([
  'de','del','con','los','las','para','por','una','uno','el','la','al','se',
  'en','y','a','e','un','o','u','cm','gb','tb','mb','bluetooth','wifi',
  'inalambrico','inalámbrico','nuevo','nueva','original','sellado','liberado',
]);

function normalizeToken(w) {
  return w
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d+)(ra|da|ro|do|ta|to|ma|mo|er)$/i, '$1');
}

function getGroupKey(name, brand) {
  const brandNorm = normalizeToken(brand || '');
  const tokens = name
    .replace(/[()[\]{}"']/g, ' ')
    .split(/[\s,.\\/|+]+/)
    .map(normalizeToken)
    .filter(w => w.length > 1 && !STOP.has(w));

  const withBrand = brandNorm && tokens[0] !== brandNorm
    ? [brandNorm, ...tokens]
    : tokens;

  return withBrand.slice(0, 4).join(' ');
}

function groupItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = getGroupKey(item.name, item.brand);
    if (!map.has(key)) {
      const label = key.replace(/\b\w/g, c => c.toUpperCase());
      map.set(key, { key, label, items: [] });
    }
    map.get(key).items.push(item);
  }
  return [...map.values()].sort((a, b) => {
    const aStores = new Set(a.items.map(i => i.source)).size;
    const bStores = new Set(b.items.map(i => i.source)).size;
    return bStores !== aStores ? bStores - aStores : b.items.length - a.items.length;
  });
}

function dedup(items) {
  const seen = new Set();
  return items.filter(item => {
    const k = itemKey(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchScreen({ navigation }) {
  const [query, setQuery]                   = useState('');
  const [groups, setGroups]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [searching, setSearching]           = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [isTextSearch, setIsTextSearch]     = useState(false);
  const [fetchError, setFetchError]         = useState(null);
  const [activeSources, setActiveSources]   = useState([]);

  const [selected, setSelected]             = useState(new Map());
  const [addingBulk, setAddingBulk]         = useState(false);
  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [showAlertStep, setShowAlertStep]   = useState(false);
  const [bulkPrice, setBulkPrice]           = useState('');
  const [resolvedIds, setResolvedIds]       = useState(new Map());
  const [successMsg, setSuccessMsg]         = useState('');

  useEffect(() => { loadCategory(CATEGORIES[0]); }, []);

  function setResults(items, sources = []) {
    const deduped = dedup(items);
    setGroups(groupItems(deduped));
    setActiveSources(sources.length ? sources : [...new Set(deduped.map(i => i.source))]);
  }

  async function loadCategory(cat) {
    setLoading(true);
    setFetchError(null);
    setIsTextSearch(false);
    setSelectedCategory(cat.label);
    setQuery('');
    setSelected(new Map());
    setActiveSources([]);
    try {
      const responses = await Promise.allSettled(cat.slugs.map(s => fetchByCategory(s, 10)));
      const all = responses.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      setResults(all, ['MercadoLibre']);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function search(overrideQuery) {
    const q = (overrideQuery || query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setSearching(true);
    setFetchError(null);
    setIsTextSearch(true);
    setSelected(new Map());
    setGroups([]);
    setActiveSources([]);
    try {
      let results = [];
      try {
        results = await fetchMultiRetailer(q, 20);
      } catch { /* server unavailable — fall through to DummyJSON */ }

      if (results.length === 0) {
        results = await fetchML(q, 20);
      }
      if (results.length === 0) setFetchError('Sin resultados para "' + q + '"');
      else setResults(results);
    } catch (e) {
      setFetchError('Sin resultados para "' + q + '"');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  function toggleSelect(item) {
    const k = itemKey(item);
    setSelected(prev => {
      const next = new Map(prev);
      next.has(k) ? next.delete(k) : next.set(k, item);
      return next;
    });
  }

  async function addBulkToList() {
    setAddingBulk(true);
    const resolved = new Map();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const [k, product] of selected) {
        const store = product.source || product.store || 'MercadoLibre';
        let productId = product.id || null;

        if (!productId) {
          const { data: ex } = await supabase.from('products')
            .select('id')
            .eq('name', product.name)
            .eq('store', store)
            .maybeSingle();
          productId = ex?.id;

          if (!productId) {
            const { data: np } = await supabase.from('products').insert({
              name:        product.name,
              price:       Math.round(product.price || 0),
              image_url:   product.imageUrl || product.image_url || null,
              store,
              brand:       product.brand || '',
              category:    product.category || '',
              image_emoji: '',
            }).select('id').single();
            productId = np?.id;
          }
        }

        if (productId) {
          await supabase.from('list_items').upsert(
            { user_id: user.id, product_id: productId, list_type: 'want_to_buy' },
            { onConflict: 'user_id,product_id,list_type' }
          );
          resolved.set(k, productId);
        }
      }
      setResolvedIds(resolved);
      setShowAlertStep(true);
    } catch (e) { console.error(e); }
    finally { setAddingBulk(false); }
  }

  async function saveAlerts() {
    const price = parseInt(bulkPrice.replace(/\D/g, ''), 10);
    if (price) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const [k] of selected) {
            const productId = resolvedIds.get(k);
            if (productId) {
              await supabase.from('price_alerts').insert({
                user_id: user.id, product_id: productId, target_price: price,
              });
            }
          }
        }
      } catch (e) { console.error(e); }
    }
    closeModal();
  }

  function closeModal() {
    const count = selected.size;
    setShowBulkModal(false);
    setShowAlertStep(false);
    setSelected(new Map());
    setBulkPrice('');
    setResolvedIds(new Map());
    setSuccessMsg(`${count} producto${count !== 1 ? 's' : ''} agregado${count !== 1 ? 's' : ''} a la lista`);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  const inSelectionMode = selected.size > 0;
  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  const resultsLabel = isTextSearch
    ? `${totalItems} resultados para "${query}"`
    : `${totalItems} productos · ${selectedCategory}`;

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search()}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => search()}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.chip, selectedCategory === cat.label && !isTextSearch && styles.chipActive]}
            onPress={() => loadCategory(cat)}
          >
            <Text style={[styles.chipText, selectedCategory === cat.label && !isTextSearch && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isTextSearch && activeSources.length > 0 && !loading && (
        <View style={styles.sourcesRow}>
          {activeSources.map(src => {
            const s = storeStyle(src);
            return (
              <View key={src} style={[styles.sourceBadge, { backgroundColor: s.bg }]}>
                <View style={[styles.sourceDot, { backgroundColor: s.color }]} />
                <Text style={[styles.sourceBadgeText, { color: s.color }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {successMsg ? (
        <View style={styles.toast}><Text style={styles.toastText}>{successMsg}</Text></View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>
            {searching ? 'Buscando en MercadoLibre y Amazon...' : 'Cargando productos...'}
          </Text>
          {searching && <Text style={styles.loadingHint}>Esto puede tomar unos segundos</Text>}
        </View>
      ) : fetchError ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Feather name="search" size={32} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>{fetchError}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Feather name="search" size={32} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>Intenta con otras palabras</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>{resultsLabel}</Text>
            {inSelectionMode && (
              <TouchableOpacity onPress={() => setSelected(new Map())}>
                <Text style={styles.clearText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {groups.map(group => {
            const stores = [...new Set(group.items.map(i => i.source))];
            return (
              <View key={group.key} style={styles.groupSection}>

                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle} numberOfLines={1}>{group.label}</Text>
                  <View style={styles.groupMeta}>
                    {stores.slice(0, 3).map(src => (
                      <View
                        key={src}
                        style={[styles.groupStoreDot, { backgroundColor: storeStyle(src).color }]}
                      />
                    ))}
                    <Text style={styles.groupCount}>
                      {group.items.length} pub.
                    </Text>
                  </View>
                </View>

                <View style={styles.grid}>
                  {group.items.map(item => {
                    const k = itemKey(item);
                    const isSelected = selected.has(k);
                    const s = storeStyle(item.source);
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[styles.card, isSelected && styles.cardSelected]}
                        onPress={() =>
                          inSelectionMode
                            ? toggleSelect(item)
                            : navigation.navigate('Product', { product: toProductShape(item) })
                        }
                        activeOpacity={0.8}
                      >
                        <TouchableOpacity style={styles.checkboxWrap} onPress={() => toggleSelect(item)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                            {isSelected && <Feather name="check" size={12} color="white" />}
                          </View>
                        </TouchableOpacity>

                        <View style={[styles.storeBadge, { backgroundColor: s.bg }]}>
                          <Text style={[styles.storeBadgeText, { color: s.color }]}>{s.label}</Text>
                        </View>

                        <View style={styles.cardImg}>
                          {item.imageUrl || item.image_url
                            ? <Image
                                source={{ uri: item.imageUrl || item.image_url }}
                                style={styles.cardImgPhoto}
                                resizeMode="contain"
                              />
                            : <Feather name="package" size={36} color={colors.muted} />
                          }
                        </View>

                        <View style={styles.cardBody}>
                          {item.brand ? (
                            <Text style={styles.cardBrand}>{item.brand.toUpperCase()}</Text>
                          ) : null}
                          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                          <Text style={[styles.cardPrice, { color: s.color }]}>
                            {item.currency === 'USD'
                              ? `US$${item.price?.toFixed(2)}`
                              : `$${item.price?.toLocaleString('es-CL')}`}
                          </Text>
                          {item.originalPrice && item.originalPrice > item.price ? (
                            <Text style={styles.cardOriginalPrice}>
                              {item.currency === 'USD'
                                ? `US$${item.originalPrice?.toFixed(2)}`
                                : `$${item.originalPrice?.toLocaleString('es-CL')}`}
                            </Text>
                          ) : null}
                        </View>

                        {item.permalink ? (
                          <TouchableOpacity
                            style={[styles.linkBtn, { borderColor: s.color }]}
                            onPress={() => Linking.openURL(item.permalink)}
                          >
                            <Text style={[styles.linkBtnText, { color: s.color }]}>Ver</Text>
                            <Feather name="arrow-right" size={11} color={s.color} />
                          </TouchableOpacity>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={{ height: inSelectionMode ? 110 : 24 }} />
        </ScrollView>
      )}

      {selected.size > 0 && (
        <View style={styles.floatBar}>
          <Text style={styles.floatCount}>
            {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={styles.floatBtn} onPress={() => setShowBulkModal(true)}>
            <Feather name="shopping-bag" size={15} color="white" />
            <Text style={styles.floatBtnText}>Agregar a lista</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showBulkModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            {!showAlertStep ? (
              <>
                <View style={styles.modalTitleRow}>
                  <Feather name="shopping-bag" size={18} color={colors.ink} />
                  <Text style={styles.modalTitle}>Quiero comprar</Text>
                </View>
                <Text style={styles.modalSub}>
                  Agregarás {selected.size} producto{selected.size !== 1 ? 's' : ''} a tu lista
                </Text>
                <View style={styles.selectedStores}>
                  {[...new Set([...selected.values()].map(p => p.source))].map(src => {
                    const s = storeStyle(src);
                    return (
                      <View key={src} style={[styles.sourceBadge, { backgroundColor: s.bg }]}>
                        <View style={[styles.sourceDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.sourceBadgeText, { color: s.color }]}>{s.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={addBulkToList} disabled={addingBulk}>
                  {addingBulk
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.btnPrimaryText}>Confirmar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBulkModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalTitleRow}>
                  <Feather name="bell" size={18} color={colors.ink} />
                  <Text style={styles.modalTitle}>Alerta de precio</Text>
                </View>
                <Text style={styles.modalSub}>
                  Avisame si cualquiera de estos {selected.size} productos baja de:
                </Text>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.pricePrefix}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={bulkPrice}
                    onChangeText={setBulkPrice}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.btnPrimary, !bulkPrice && { opacity: 0.5 }]}
                  onPress={saveAlerts}
                  disabled={!bulkPrice}
                >
                  <Text style={styles.btnPrimaryText}>Activar alertas</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Omitir</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },

  header:           { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:          { padding: 4 },
  searchInput:      { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.border, fontSize: 14, color: colors.ink },
  searchBtn:        { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnText:    { color: 'white', fontWeight: '700', fontSize: 14 },

  chipsScroll:      { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  chipsContent:     { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:             { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive:       { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText:         { fontSize: 13, color: colors.muted, fontWeight: '500' },
  chipTextActive:   { color: colors.surface, fontWeight: '600' },

  sourcesRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sourceBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  sourceDot:        { width: 7, height: 7, borderRadius: 4 },
  sourceBadgeText:  { fontSize: 11, fontWeight: '600' },

  toast:            { backgroundColor: colors.ink, margin: 16, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  toastText:        { color: 'white', fontWeight: '600', fontSize: 14 },

  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText:      { fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  loadingHint:      { fontSize: 12, color: colors.muted, textAlign: 'center', opacity: 0.6 },
  empty:            { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyText:        { fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 32 },

  scrollContent:    { padding: 16, paddingBottom: 24 },
  resultsHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultsText:      { fontSize: 13, color: colors.muted },
  clearText:        { fontSize: 13, color: colors.accent, fontWeight: '600' },

  groupSection:     { marginBottom: 28 },
  groupHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  groupTitle:       { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8 },
  groupMeta:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  groupStoreDot:    { width: 8, height: 8, borderRadius: 4 },
  groupCount:       { fontSize: 11, color: colors.muted, marginLeft: 2 },

  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:             { width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  cardSelected:     { borderColor: colors.accent, backgroundColor: colors.redBg },
  checkboxWrap:     { position: 'absolute', top: 8, left: 8, zIndex: 10, padding: 4 },
  checkbox:         { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:  { backgroundColor: colors.accent, borderColor: colors.accent },
  storeBadge:       { position: 'absolute', top: 8, right: 8, zIndex: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm },
  storeBadgeText:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  cardImg:          { width: '100%', aspectRatio: 1, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  cardImgPhoto:     { width: '100%', height: '100%' },
  cardBody:         { padding: 10 },
  cardBrand:        { fontSize: 9, color: colors.muted, letterSpacing: 0.5, marginBottom: 2 },
  cardName:         { fontSize: 12, fontWeight: '600', color: colors.ink, marginBottom: 5, lineHeight: 17 },
  cardPrice:        { fontSize: 16, fontWeight: '800', marginBottom: 1 },
  cardOriginalPrice:{ fontSize: 11, color: colors.muted, textDecorationLine: 'line-through', opacity: 0.7 },
  linkBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, margin: 8, marginTop: 0, borderWidth: 1.5, borderRadius: radius.sm, paddingVertical: 6 },
  linkBtnText:      { fontSize: 12, fontWeight: '600' },

  floatBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, backgroundColor: colors.ink, gap: 12 },
  floatCount:       { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  floatBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12 },
  floatBtnText:     { color: 'white', fontWeight: '700', fontSize: 14 },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, margin: 16, gap: 12 },
  modalTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalSub:         { fontSize: 14, color: colors.muted, lineHeight: 20 },
  selectedStores:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priceInputWrap:   { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16 },
  pricePrefix:      { fontSize: 24, fontWeight: '700', color: colors.muted, marginRight: 4 },
  priceInput:       { flex: 1, fontSize: 32, fontWeight: '700', color: colors.ink, paddingVertical: 14 },
  btnPrimary:       { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  btnPrimaryText:   { color: 'white', fontSize: 16, fontWeight: '700' },
  cancelBtn:        { padding: 14, alignItems: 'center' },
  cancelBtnText:    { fontSize: 15, color: colors.muted },
});
