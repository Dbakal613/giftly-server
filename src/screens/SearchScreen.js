import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, Image, ScrollView
} from 'react-native';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { SERVER_URL } from '../lib/config';
import { colors, radius, shadow } from '../lib/theme';

const LISTS = [
  { key: 'want_to_buy',    label: '🛍️ Quiero comprar', color: '#D94F3D' },
  { key: 'bought',         label: '✅ Compré',          color: '#2D8C5E' },
  { key: 'recommend',      label: '👍 Recomiendo',      color: '#3D7DD9' },
  { key: 'not_recommend',  label: '👎 No recomiendo',   color: '#8A8A82' },
];

const CATEGORIES = [
  { label: 'Todo',        queries: ['tecnologia', 'zapatillas', 'hogar'] },
  { label: 'Tecnología',  queries: ['smartphone iphone samsung', 'laptop notebook', 'audifonos airpods'] },
  { label: 'Moda',        queries: ['zapatillas nike adidas', 'ropa mujer', 'ropa hombre'] },
  { label: 'Hogar',       queries: ['cafetera nespresso', 'electrodomesticos cocina', 'decoracion hogar'] },
  { label: 'Deportes',    queries: ['bicicleta', 'ropa deportiva', 'suplementos proteina'] },
  { label: 'Belleza',     queries: ['perfume', 'maquillaje', 'cuidado piel'] },
  { label: 'Juguetes',    queries: ['lego', 'juguetes niños', 'consola videojuegos'] },
];

function extractBrand(attributes = []) {
  return attributes.find(a => a.id === 'BRAND')?.value_name || '';
}

function mapMLProduct(item) {
  return {
    id: null,
    mlId: item.id,
    name: item.title,
    price: item.price,
    image_url: item.thumbnail?.replace('-I.jpg', '-O.jpg') || item.thumbnail || null,
    store: 'MercadoLibre',
    brand: extractBrand(item.attributes),
    category: '',
    permalink: item.permalink,
    isMLProduct: true,
  };
}

async function fetchFromML(q, limit = 10) {
  const res = await axios.get(`${SERVER_URL}/search`, { params: { q, limit }, timeout: 4000 });
  return (res.data?.results || []).map(mapMLProduct);
}

async function fetchFromSupabase(q) {
  const { data } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%,store.ilike.%${q}%`)
    .gt('price', 0);
  return (data || []);
}

async function fetchQuery(q, limit = 10) {
  try {
    const items = await fetchFromML(q, limit);
    if (items.length > 0) return items;
    return await fetchFromSupabase(q);
  } catch {
    return await fetchFromSupabase(q);
  }
}

function dedup(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.mlId)) return false;
    seen.add(item.mlId);
    return true;
  });
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery]                   = useState('');
  const [results, setResults]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [isTextSearch, setIsTextSearch]     = useState(false);
  const [fetchError, setFetchError]         = useState(null);
  const [addingId, setAddingId]             = useState(null);
  const [modalVisible, setModalVisible]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [successMsg, setSuccessMsg]         = useState('');

  useEffect(() => { loadCategory(CATEGORIES[0]); }, []);

  async function loadCategory(cat) {
    setLoading(true);
    setFetchError(null);
    setIsTextSearch(false);
    setSelectedCategory(cat.label);
    setQuery('');
    try {
      // Try ML first for all category queries in parallel
      const responses = await Promise.all(cat.queries.map(q => fetchQuery(q, 10)));
      const items = dedup(responses.flat());
      if (items.length === 0) {
        const { data } = await supabase.from('products').select('*').gt('price', 0).limit(50);
        setResults(data || []);
      } else {
        setResults(items);
      }
    } catch (e) {
      const { data } = await supabase.from('products').select('*').gt('price', 0).limit(50);
      setResults(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function search(overrideQuery) {
    const q = (overrideQuery || query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setFetchError(null);
    setIsTextSearch(true);
    setResults([]);
    try {
      const items = await fetchQuery(q, 50);
      setResults(items);
    } catch (e) {
      setFetchError(e.message || 'Error de conexión');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function addToList(product, listType) {
    setAddingId(product.mlId);
    setModalVisible(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let productId = product.id;
      if (!productId) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('name', product.name)
          .eq('store', 'MercadoLibre')
          .maybeSingle();

        productId = existing?.id;
        if (!productId) {
          const { data: newP } = await supabase
            .from('products')
            .insert({
              name: product.name,
              price: Math.round(product.price || 0),
              image_url: product.image_url,
              store: 'MercadoLibre',
              brand: product.brand || '',
              category: product.category || '',
              image_emoji: '📦',
            })
            .select('id')
            .single();
          productId = newP?.id;
        }
      }

      if (!productId) return;
      await supabase.from('list_items').upsert(
        { user_id: user.id, product_id: productId, list_type: listType },
        { onConflict: 'user_id,product_id,list_type' }
      );
      setSuccessMsg('✓ Agregado a tu lista');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error('addToList error:', e);
    } finally {
      setAddingId(null);
    }
  }

  const resultsLabel = isTextSearch
    ? `${results.length} resultados para "${query}"`
    : `${results.length} productos · ${selectedCategory}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar en todas las tiendas..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search()}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => search()}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
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

      {/* Toast */}
      {successMsg ? (
        <View style={styles.toast}><Text style={styles.toastText}>{successMsg}</Text></View>
      ) : null}

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          {fetchError ? (
            <>
              <Text style={styles.emptyIcon}>⚠️</Text>
              <Text style={styles.emptyTitle}>Error de conexión</Text>
              <Text style={styles.emptyText}>{fetchError}</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>Intenta con otras palabras</Text>
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* Results count */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>{resultsLabel}</Text>
            <View style={styles.mlBadge}><Text style={styles.mlBadgeText}>MercadoLibre</Text></View>
          </View>
          {/* Grid */}
          <View style={styles.grid}>
            {results.map((item, i) => (
              <TouchableOpacity
                key={item.mlId || i}
                style={styles.card}
                onPress={() => navigation.navigate('Product', { product: item })}
                activeOpacity={0.8}
              >
                <View style={styles.cardImg}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={styles.cardImgPhoto} resizeMode="contain" />
                    : <Text style={styles.cardEmoji}>📦</Text>
                  }
                </View>
                <View style={styles.cardBody}>
                  {item.brand ? <Text style={styles.cardBrand}>{item.brand.toUpperCase()}</Text> : null}
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardPrice}>${item.price?.toLocaleString('es-CL')}</Text>
                  <Text style={styles.cardCompare}>Comparar precios →</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, addingId === item.mlId && styles.addBtnLoading]}
                  onPress={e => { e.stopPropagation(); setSelectedProduct(item); setModalVisible(true); }}
                  disabled={addingId === item.mlId}
                >
                  {addingId === item.mlId
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.addBtnText}>+ Lista</Text>
                  }
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Add-to-list modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Agregar a lista</Text>
            <Text style={styles.modalProduct} numberOfLines={1}>{selectedProduct?.name}</Text>
            {LISTS.map(list => (
              <TouchableOpacity
                key={list.key}
                style={styles.listOption}
                onPress={() => addToList(selectedProduct, list.key)}
              >
                <Text style={styles.listOptionText}>{list.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FAFAF7' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn:         { padding: 4 },
  backText:        { fontSize: 22, color: '#1A1A18' },
  searchInput:     { flex: 1, backgroundColor: '#FAFAF7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#E8E8E2', fontSize: 15 },
  searchBtn:       { backgroundColor: '#D94F3D', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnText:   { color: 'white', fontWeight: '700', fontSize: 14 },
  chipsScroll:     { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2', flexGrow: 0 },
  chipsContent:    { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:            { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  chipActive:      { backgroundColor: '#1A1A18', borderColor: '#1A1A18' },
  chipText:        { fontSize: 13, color: '#8A8A82', fontWeight: '500' },
  chipTextActive:  { color: '#FFFFFF', fontWeight: '600' },
  toast:           { backgroundColor: '#1A1A18', margin: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  toastText:       { color: 'white', fontWeight: '600', fontSize: 14 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:     { fontSize: 14, color: '#8A8A82' },
  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#1A1A18', marginBottom: 6 },
  emptyText:       { fontSize: 14, color: '#8A8A82' },
  list:            { padding: 16, gap: 10 },
  resultsHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  resultsText:     { fontSize: 13, color: '#8A8A82', flex: 1 },
  mlBadge:         { backgroundColor: '#FEF9E8', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#E8A020' },
  mlBadgeText:     { fontSize: 11, color: '#E8A020', fontWeight: '600' },
  card:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E8E8E2', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  productImage:    { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F0EFE8', flexShrink: 0 },
  emojiWrap:       { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiText:       { fontSize: 28 },
  info:            { flex: 1, minWidth: 0 },
  brand:           { fontSize: 10, color: '#8A8A82', letterSpacing: 0.5, marginBottom: 2 },
  name:            { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 4 },
  price:           { fontSize: 16, fontWeight: '700', color: '#D94F3D', marginBottom: 2 },
  storeTag:        { fontSize: 12, color: '#3D7DD9', fontWeight: '500' },
  addBtn:          { backgroundColor: '#D94F3D', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 60, alignItems: 'center', flexShrink: 0 },
  addBtnLoading:   { opacity: 0.7 },
  addBtnText:      { color: 'white', fontWeight: '600', fontSize: 13 },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, margin: 16, gap: 10 },
  modalTitle:      { fontSize: 18, fontWeight: '700', color: '#1A1A18' },
  modalProduct:    { fontSize: 13, color: '#8A8A82', marginBottom: 4 },
  listOption:      { backgroundColor: '#FAFAF7', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  listOptionText:  { fontSize: 15, fontWeight: '500', color: '#1A1A18' },
  cancelBtn:       { padding: 14, alignItems: 'center' },
  cancelBtnText:   { fontSize: 15, color: '#8A8A82' },
});
