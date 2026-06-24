import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Image, Dimensions,
} from 'react-native';
import { PRODUCTS, CATEGORIES, BRANDS, searchProducts, formatPrice } from '../data/products';
import { colors, radius, shadow } from '../lib/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

export default function ExploreScreen({ navigation }) {
  const [query, setQuery]               = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeBrand, setActiveBrand]   = useState(null);

  const filtered = useMemo(() => {
    let results = query ? searchProducts(query) : PRODUCTS;
    if (activeCategory) results = results.filter(p => p.category === activeCategory);
    if (activeBrand)    results = results.filter(p => p.brand === activeBrand);
    return results;
  }, [query, activeCategory, activeBrand]);

  const hasFilters = !!(query || activeCategory || activeBrand);

  function toggleCategory(id) {
    setActiveCategory(prev => prev === id ? null : id);
  }

  function toggleBrand(brand) {
    setActiveBrand(prev => prev === brand ? null : brand);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          <Text style={styles.subtitle}>Explora productos y guárdalos en tus listas</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* Search (sticky) */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar productos, marcas..."
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
            />
            {hasFilters && (
              <TouchableOpacity onPress={() => { setQuery(''); setActiveCategory(null); setActiveBrand(null); }}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category chips */}
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
                {cat.emoji} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Brand chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsRow, { paddingTop: 0 }]}
        >
          {BRANDS.map(brand => (
            <TouchableOpacity
              key={brand}
              style={[styles.chip, styles.chipBrand, activeBrand === brand && styles.chipActive]}
              onPress={() => toggleBrand(brand)}
            >
              <Text style={[styles.chipText, activeBrand === brand && styles.chipTextActive]}>
                {brand}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results meta */}
        <View style={styles.resultsMeta}>
          <Text style={styles.resultsText}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
            {activeCategory ? ` · ${CATEGORIES.find(c => c.id === activeCategory)?.label}` : ''}
            {activeBrand ? ` · ${activeBrand}` : ''}
          </Text>
        </View>

        {/* Product grid */}
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
                    <Text style={styles.cardEmoji}>🎁</Text>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardBrand}>{product.brand}</Text>
                  <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(product.price, product.currency)}</Text>
                </View>
                <View style={styles.saveHint}>
                  <Text style={styles.saveHintText}>＋ Guardar</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>Intenta con otros términos o limpia los filtros</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'Inicio',   screen: 'Home' },
          { icon: '✨', label: 'Explorar',  screen: null,   active: true },
          { icon: '👥', label: 'Amigos',   screen: 'Friends' },
          { icon: '👤', label: 'Perfil',   screen: 'Profile' },
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
  container:      { flex: 1, backgroundColor: colors.bg },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo:           { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -1 },
  logoBlack:      { color: colors.ink },
  subtitle:       { fontSize: 12, color: colors.muted, marginTop: 2 },
  profileBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  profileIcon:    { fontSize: 18 },

  // Search
  searchSection:  { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tagBg, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchIcon:     { fontSize: 15 },
  searchInput:    { flex: 1, fontSize: 14, color: colors.ink },
  clearText:      { fontSize: 16, color: colors.muted, paddingHorizontal: 4 },

  // Chips
  chipsRow:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipBrand:      { borderStyle: 'dashed' },
  chipActive:     { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText:       { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: 'white' },

  // Results meta
  resultsMeta:    { paddingHorizontal: 20, paddingVertical: 4, paddingBottom: 12 },
  resultsText:    { fontSize: 12, color: colors.muted, fontWeight: '500' },

  // Grid
  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  card:           { width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  cardImg:        { width: '100%', aspectRatio: 1, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  cardImgPhoto:   { width: '100%', height: '100%' },
  cardEmoji:      { fontSize: 52 },
  cardBody:       { padding: 11 },
  cardBrand:      { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  cardName:       { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6, lineHeight: 18 },
  cardPrice:      { fontSize: 16, fontWeight: '800', color: colors.accent },
  saveHint:       { marginHorizontal: 11, marginBottom: 11, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.redBg, alignItems: 'center' },
  saveHintText:   { fontSize: 11, fontWeight: '700', color: colors.accent },

  // Empty
  empty:          { alignItems: 'center', padding: 48 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyText:      { fontSize: 14, color: colors.muted, textAlign: 'center' },

  // Bottom nav
  bottomNav:      { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 28, paddingTop: 10 },
  navItem:        { flex: 1, alignItems: 'center', gap: 2 },
  navIcon:        { fontSize: 22 },
  navLabel:       { fontSize: 10, color: colors.muted, fontWeight: '500' },
  navLabelActive: { color: colors.accent, fontWeight: '700' },
});
