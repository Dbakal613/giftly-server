import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Image, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PRODUCTS, CATEGORIES, searchProducts, formatPrice } from '../data/products';
import { colors, radius, shadow } from '../lib/theme';
import BottomNav from '../components/BottomNav';

const { width } = Dimensions.get('window');
const CARD_W = (width - 58) / 5;

export default function ExploreScreen({ navigation }) {
  const [query, setQuery]               = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const filtered = useMemo(() => {
    let results = query ? searchProducts(query) : PRODUCTS;
    if (activeCategory) results = results.filter(p => p.category === activeCategory);
    return results;
  }, [query, activeCategory]);

  const hasFilters = !!(query || activeCategory);

  function toggleCategory(id) {
    setActiveCategory(prev => prev === id ? null : id);
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          <Text style={styles.subtitle}>Explora y guarda en tus listas</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
          <Feather name="user" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── Search (sticky) ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <Feather name="search" size={15} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar productos, marcas..."
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
            />
            {hasFilters && (
              <TouchableOpacity onPress={() => { setQuery(''); setActiveCategory(null); }}>
                <Feather name="x" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Category chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, activeCategory === cat.id && styles.chipActive]}
              onPress={() => toggleCategory(cat.id)}
            >
              <Text style={[styles.chipText, activeCategory === cat.id && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Results meta ── */}
        <View style={styles.resultsMeta}>
          <Text style={styles.resultsText}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
            {activeCategory ? ` · ${CATEGORIES.find(c => c.id === activeCategory)?.label}` : ''}
          </Text>
        </View>

        {/* ── Product grid ── */}
        {filtered.length > 0 ? (
          <View style={styles.grid}>
            {filtered.map(product => (
              <TouchableOpacity
                key={product.id}
                style={styles.card}
                onPress={() => navigation.navigate('Product', { product })}
                activeOpacity={0.85}
              >
                <View style={styles.cardImg}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={styles.cardImgPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <Feather name="package" size={20} color={colors.muted} />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(product.price, product.currency)}</Text>
                </View>
                <View style={styles.saveHint}>
                  <Feather name="plus" size={8} color={colors.accent} />
                  <Text style={styles.saveHintText}>Guardar</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Feather name="search" size={28} color={colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>Intenta con otros términos o limpia los filtros</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <BottomNav navigation={navigation} active="Explore" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo:           { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  logoBlack:      { color: colors.ink },
  subtitle:       { fontSize: 12, color: colors.muted, marginTop: 2 },
  profileBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  // Search
  searchSection:  { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tagBg, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchInput:    { flex: 1, fontSize: 14, color: colors.ink },

  // Chips
  chipsRow:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText:       { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: 'white' },

  // Results meta
  resultsMeta:    { paddingHorizontal: 20, paddingBottom: 10 },
  resultsText:    { fontSize: 12, color: colors.muted, fontWeight: '500' },

  // Grid
  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  card:           { width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  cardImg:        { width: '100%', aspectRatio: 1, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  cardImgPhoto:   { width: '100%', height: '100%' },
  cardBody:       { padding: 5 },
  cardName:       { fontSize: 10, fontWeight: '600', color: colors.ink, marginBottom: 2, lineHeight: 13 },
  cardPrice:      { fontSize: 11, fontWeight: '800', color: colors.accent },
  saveHint:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginHorizontal: 5, marginBottom: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.redBg },
  saveHintText:   { fontSize: 9, fontWeight: '700', color: colors.accent },

  // Empty
  empty:          { alignItems: 'center', padding: 48 },
  emptyIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyText:      { fontSize: 14, color: colors.muted, textAlign: 'center' },
});
