import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { CATEGORIES } from '../data/products';
import {
  getRecommendations, BUDGET_RANGES, FEEDBACK_OPTIONS,
} from '../services/recommendations';
import { getCurrentUser } from '../services/auth';
import { fetchProfile } from '../services/profiles';
import ScreenHeader from '../components/ScreenHeader';

export default function RecommendationsScreen({ navigation, route }) {
  const [occasion, setOccasion] = useState(null);
  const [budget, setBudget]     = useState('any');
  const [catFilter, setCatFilter] = useState(null);

  const [recs, setRecs]             = useState([]);
  const [preferences, setPrefs]     = useState([]);
  const [dismissed, setDismissed]   = useState(new Set());
  const [feedback, setFeedback]     = useState(new Map());
  const [showPrivacy, setShowPrivacy] = useState(true);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (!loading) regenerate();
  }, [occasion, budget, catFilter, dismissed, preferences]);

  async function loadPreferences() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const { data: profile } = await fetchProfile(user.id, 'preferred_categories');
        setPrefs(profile?.preferred_categories || []);
      }
    } catch (e) {
      console.error('loadPreferences:', e);
    } finally {
      setLoading(false);
    }
  }

  const regenerate = useCallback(() => {
    const budgetRange = BUDGET_RANGES.find(r => r.key === budget);
    const results = getRecommendations({
      preferredCategories: preferences,
      categoryFilter:      catFilter,
      occasion:            occasion,
      budgetMin:           budgetRange?.min ?? 0,
      budgetMax:           budgetRange?.max ?? null,
      mode:                'self',
      exclude:             dismissed,
    });
    setRecs(results);
  }, [occasion, budget, catFilter, dismissed, preferences]);

  function handleFeedback(productId, key) {
    setFeedback(prev => {
      const next = new Map(prev);
      const existing = next.get(productId);
      next.set(productId, existing === key ? null : key);
      return next;
    });
    if (key === 'dislike' || key === 'expensive') {
      setDismissed(prev => new Set([...prev, productId]));
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Para ti" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </View>
    );
  }

  const budgetRange = BUDGET_RANGES.find(r => r.key === budget);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Para ti" onBack={() => navigation.goBack()} />

      <FlatList
        data={recs}
        keyExtractor={item => item.product.id}
        ListHeaderComponent={
          <ListHeader
            occasion={occasion} setOccasion={setOccasion}
            budget={budget} setBudget={setBudget}
            catFilter={catFilter} setCatFilter={setCatFilter}
            showPrivacy={showPrivacy} setShowPrivacy={setShowPrivacy}
            total={recs.length}
            onGiftMode={() => navigation.navigate('GiftRecommendations')}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Feather name="inbox" size={32} color={colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>Prueba ampliar el presupuesto o cambiar los filtros.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <RecCard
            item={item}
            activeFeedback={feedback.get(item.product.id) || null}
            onFeedback={(key) => handleFeedback(item.product.id, key)}
            onPress={() => navigation.navigate('Product', { product: item.product })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={() => <View style={{ height: 40 }} />}
      />
    </View>
  );
}

function ListHeader({ occasion, setOccasion, budget, setBudget, catFilter, setCatFilter, showPrivacy, setShowPrivacy, total, onGiftMode }) {
  return (
    <View>
      {showPrivacy && (
        <View style={styles.privacyBanner}>
          <Feather name="shield" size={15} color={colors.blue} />
          <Text style={styles.privacyText}>Usamos tus intereses para personalizar esto. Tus datos no salen de la app.</Text>
          <TouchableOpacity onPress={() => setShowPrivacy(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, styles.modeBtnActive]}
          onPress={() => setMode('self')}
        >
          <Feather name="user" size={14} color="white" />
          <Text style={[styles.modeBtnText, styles.modeBtnTextActive]}>Para mí</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modeBtn}
          onPress={onGiftMode}
        >
          <Feather name="gift" size={14} color={colors.muted} />
          <Text style={styles.modeBtnText}>Para regalar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        <Text style={styles.filterSectionLabel}>Presupuesto</Text>
        {BUDGET_RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.chip, budget === r.key && styles.chipActive]}
            onPress={() => setBudget(r.key)}
          >
            <Text style={[styles.chipText, budget === r.key && styles.chipTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        <Text style={styles.filterSectionLabel}>Categoría</Text>
        <TouchableOpacity
          style={[styles.chip, catFilter === null && styles.chipActive]}
          onPress={() => setCatFilter(null)}
        >
          <Text style={[styles.chipText, catFilter === null && styles.chipTextActive]}>Todo</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, catFilter === cat.id && styles.chipActive]}
            onPress={() => setCatFilter(prev => prev === cat.id ? null : cat.id)}
          >
            <Feather name={cat.icon} size={12} color={catFilter === cat.id ? 'white' : colors.muted} />
            <Text style={[styles.chipText, catFilter === cat.id && styles.chipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>{total} sugerencia{total !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

function RecCard({ item, activeFeedback, onFeedback, onPress }) {
  const { product, why } = item;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardMain}>
        <View style={styles.cardImg}>
          {product.image_url
            ? <Image source={{ uri: product.image_url }} style={styles.cardImgPhoto} resizeMode="cover" />
            : <Feather name="package" size={30} color={colors.muted} />
          }
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardBrand}>{product.brand}</Text>
          <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.cardPrice}>${product.price?.toLocaleString('es-CL')}</Text>
        </View>
        <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
          <Feather name="arrow-right" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.whyRow}>
        <Feather name="zap" size={11} color={colors.accent} />
        <Text style={styles.whyText}>{why}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedbackRow}>
        {FEEDBACK_OPTIONS.map(opt => {
          const isActive = activeFeedback === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.feedbackChip, isActive && styles.feedbackChipActive]}
              onPress={() => onFeedback(opt.key)}
            >
              <Feather
                name={opt.icon}
                size={11}
                color={isActive ? 'white' : colors.muted}
              />
              <Text style={[styles.feedbackText, isActive && styles.feedbackTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:  { padding: 16, paddingTop: 8 },

  privacyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blueBg, borderRadius: radius.md, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.blue + '30' },
  privacyText:   { flex: 1, fontSize: 12, color: colors.blue, lineHeight: 17 },

  modeRow:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.tagBg, borderWidth: 1.5, borderColor: 'transparent' },
  modeBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  modeBtnText:  { fontSize: 14, fontWeight: '600', color: colors.muted },
  modeBtnTextActive: { color: 'white' },

  filterScroll:  { flexGrow: 0, marginBottom: 8 },
  filterContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  filterSectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 2 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:      { fontSize: 12, fontWeight: '500', color: colors.muted },
  chipTextActive: { color: 'white', fontWeight: '600' },

  resultsHeader: { marginBottom: 4 },
  resultsText:   { fontSize: 12, color: colors.muted, fontWeight: '500' },

  emptyWrap:     { alignItems: 'center', paddingTop: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyText:     { fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 32 },

  card:          { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm },
  cardMain:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardImg:       { width: 78, height: 78, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  cardImgPhoto:  { width: 78, height: 78 },
  cardInfo:      { flex: 1 },
  cardBrand:     { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  cardName:      { fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 19, marginBottom: 5 },
  cardPrice:     { fontSize: 17, fontWeight: '800', color: colors.accent },
  viewBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  whyRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 10 },
  whyText:       { fontSize: 12, color: colors.accent, fontWeight: '500' },

  feedbackRow:   { paddingHorizontal: 14, paddingBottom: 12, gap: 6, flexDirection: 'row' },
  feedbackChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  feedbackChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  feedbackText:  { fontSize: 11, color: colors.muted, fontWeight: '500' },
  feedbackTextActive: { color: 'white', fontWeight: '600' },
});
