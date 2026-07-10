import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { CATEGORIES } from '../data/products';
import {
  getGiftRecommendations, BUDGET_RANGES, OCCASIONS, FEEDBACK_OPTIONS,
} from '../services/recommendations';
import { relationshipIcon, relationshipLabel } from '../services/recipients';
import ScreenHeader from '../components/ScreenHeader';

export default function GiftRecommendationsScreen({ route, navigation }) {
  const [recipient, setRecipient]     = useState(route.params?.recipient || null);
  const [occasion, setOccasion]       = useState(null);
  const [budget, setBudget]           = useState('any');
  const [catFilter, setCatFilter]     = useState(null);

  const [recs, setRecs]               = useState([]);
  const [dismissed, setDismissed]     = useState(new Set());
  const [feedback, setFeedback]       = useState(new Map());

  useEffect(() => {
    if (route.params?.recipient) {
      setRecipient(route.params.recipient);
    }
  }, [route.params?.recipient]);

  useEffect(() => {
    if (recipient) regenerate();
    else setRecs([]);
  }, [recipient, occasion, budget, catFilter, dismissed]);

  const regenerate = useCallback(() => {
    const budgetRange = BUDGET_RANGES.find(r => r.key === budget);
    setRecs(getGiftRecommendations({
      recipient,
      categoryFilter:  catFilter,
      occasionOverride: occasion,
      budgetMin:       budgetRange?.min ?? 0,
      budgetMax:       budgetRange?.max ?? null,
      exclude:         dismissed,
    }));
  }, [recipient, occasion, budget, catFilter, dismissed]);

  function handleFeedback(productId, key) {
    setFeedback(prev => {
      const next = new Map(prev);
      next.set(productId, next.get(productId) === key ? null : key);
      return next;
    });
    if (key === 'dislike' || key === 'expensive') {
      setDismissed(prev => new Set([...prev, productId]));
    }
  }

  const title = recipient ? `Para ${recipient.name}` : 'Para regalar';

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      <FlatList
        data={recipient ? recs : []}
        keyExtractor={item => item.product.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Header
            recipient={recipient}
            occasion={occasion} setOccasion={setOccasion}
            budget={budget}   setBudget={setBudget}
            catFilter={catFilter} setCatFilter={setCatFilter}
            total={recs.length}
            onPickRecipient={() => navigation.navigate('RecipientPicker', { returnTo: 'GiftRecommendations' })}
            onEditRecipient={() => navigation.navigate('RecipientForm', { mode: 'edit', recipient, returnTo: 'GiftRecommendations' })}
          />
        }
        ListEmptyComponent={
          !recipient
            ? <NoRecipientState onPick={() => navigation.navigate('RecipientPicker', { returnTo: 'GiftRecommendations' })} />
            : <EmptyRecsState />
        }
        renderItem={({ item }) => (
          <GiftRecCard
            item={item}
            activeFeedback={feedback.get(item.product.id) || null}
            onFeedback={key => handleFeedback(item.product.id, key)}
            onPress={() => navigation.navigate('Product', { product: item.product })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={() => <View style={{ height: 48 }} />}
      />
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NoRecipientState({ onPick }) {
  return (
    <View style={styles.noRecipient}>
      <View style={styles.noRecipientIcon}>
        <Feather name="gift" size={40} color={colors.accent} />
      </View>
      <Text style={styles.noRecipientTitle}>¿Para quién es el regalo?</Text>
      <Text style={styles.noRecipientText}>
        Elige a una persona y Giftly buscará opciones pensadas especialmente para ella.
      </Text>
      <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
        <Feather name="user-plus" size={16} color="white" />
        <Text style={styles.pickBtnText}>Seleccionar destinatario</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyRecsState() {
  return (
    <View style={styles.emptyRecs}>
      <Feather name="inbox" size={28} color={colors.muted} />
      <Text style={styles.emptyRecsText}>Sin resultados con estos filtros</Text>
    </View>
  );
}

function Header({ recipient, occasion, setOccasion, budget, setBudget, catFilter, setCatFilter, total, onPickRecipient, onEditRecipient }) {
  if (!recipient) return null;

  const icon  = relationshipIcon(recipient.relationship);
  const label = relationshipLabel(recipient.relationship);
  const budgetRange = BUDGET_RANGES.find(r => r.key === budget);

  return (
    <View>
      {/* Recipient card */}
      <View style={styles.recipientCard}>
        <View style={styles.recipientAvatarWrap}>
          <Feather name={icon} size={22} color={colors.accent} />
        </View>
        <View style={styles.recipientInfo}>
          <Text style={styles.recipientName}>{recipient.name}</Text>
          <Text style={styles.recipientRelation}>{label}</Text>
          {recipient.interests?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll} contentContainerStyle={styles.tagsContent}>
              {recipient.interests.slice(0, 5).map(i => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{i}</Text>
                </View>
              ))}
              {recipient.interests.length > 5 && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>+{recipient.interests.length - 5}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
        <View style={styles.recipientActions}>
          <TouchableOpacity style={styles.recipientActionBtn} onPress={onEditRecipient}>
            <Feather name="edit-2" size={14} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.recipientActionBtn} onPress={onPickRecipient}>
            <Feather name="refresh-cw" size={14} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Occasion filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <Text style={styles.filterLabel}>Ocasión</Text>
        {OCCASIONS.map(occ => {
          const active = occasion === occ.key;
          return (
            <TouchableOpacity
              key={occ.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setOccasion(prev => prev === occ.key ? null : occ.key)}
            >
              <Feather name={occ.icon} size={11} color={active ? 'white' : colors.muted} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{occ.key}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Budget filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <Text style={styles.filterLabel}>Presupuesto</Text>
        {BUDGET_RANGES.map(r => {
          const active = budget === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setBudget(r.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <Text style={styles.filterLabel}>Categoría</Text>
        <TouchableOpacity
          style={[styles.chip, catFilter === null && styles.chipActive]}
          onPress={() => setCatFilter(null)}
        >
          <Text style={[styles.chipText, catFilter === null && styles.chipTextActive]}>Todo</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => {
          const active = catFilter === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCatFilter(prev => prev === cat.id ? null : cat.id)}
            >
              <Feather name={cat.icon} size={11} color={active ? 'white' : colors.muted} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Budget + recipient budget mismatch hint */}
      {recipient.budget_max && budgetRange?.max && budgetRange.max > recipient.budget_max && (
        <View style={styles.budgetHint}>
          <Feather name="info" size={13} color={colors.blue} />
          <Text style={styles.budgetHintText}>
            El presupuesto habitual de {recipient.name} es ${recipient.budget_max.toLocaleString('es-CL')}
          </Text>
        </View>
      )}

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{total} idea{total !== 1 ? 's' : ''} para {recipient.name}</Text>
      </View>
    </View>
  );
}

function GiftRecCard({ item, activeFeedback, onFeedback, onPress }) {
  const { product, why } = item;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardMain}>
        <View style={styles.cardImg}>
          {product.image_url
            ? <Image source={{ uri: product.image_url }} style={styles.cardImgPhoto} resizeMode="cover" />
            : <Feather name="package" size={28} color={colors.muted} />
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
          const active = activeFeedback === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.feedbackChip, active && styles.feedbackChipActive]}
              onPress={() => onFeedback(opt.key)}
            >
              <Feather name={opt.icon} size={11} color={active ? 'white' : colors.muted} />
              <Text style={[styles.feedbackText, active && styles.feedbackTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 16, paddingTop: 12 },

  noRecipient:      { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  noRecipientIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  noRecipientTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
  noRecipientText:  { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  pickBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: 24, paddingVertical: 14 },
  pickBtnText:      { color: 'white', fontWeight: '700', fontSize: 15 },

  emptyRecs:     { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyRecsText: { fontSize: 14, color: colors.muted },

  recipientCard:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  recipientAvatarWrap: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  recipientInfo:       { flex: 1 },
  recipientName:       { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  recipientRelation:   { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
  tagsScroll:          { flexGrow: 0 },
  tagsContent:         { flexDirection: 'row', gap: 6 },
  tag:                 { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.tagBg },
  tagText:             { fontSize: 11, color: colors.muted, fontWeight: '500' },
  recipientActions:    { flexDirection: 'row', gap: 6, marginLeft: 8 },
  recipientActionBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  filterRow:     { flexGrow: 0, marginBottom: 8 },
  filterContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  filterLabel:   { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 2 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:      { fontSize: 12, fontWeight: '500', color: colors.muted },
  chipTextActive:{ color: 'white', fontWeight: '600' },

  budgetHint:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueBg, borderRadius: radius.md, padding: 10, marginBottom: 8 },
  budgetHintText: { flex: 1, fontSize: 12, color: colors.blue },

  resultsRow:  { marginBottom: 8 },
  resultsText: { fontSize: 12, color: colors.muted, fontWeight: '500' },

  card:        { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm },
  cardMain:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardImg:     { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  cardImgPhoto:{ width: 76, height: 76 },
  cardInfo:    { flex: 1 },
  cardBrand:   { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  cardName:    { fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 19, marginBottom: 5 },
  cardPrice:   { fontSize: 17, fontWeight: '800', color: colors.accent },
  viewBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  whyRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  whyText:     { flex: 1, fontSize: 12, color: colors.accent, fontWeight: '500', lineHeight: 17 },

  feedbackRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 6, flexDirection: 'row' },
  feedbackChip:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  feedbackChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  feedbackText:      { fontSize: 11, color: colors.muted, fontWeight: '500' },
  feedbackTextActive:{ color: 'white', fontWeight: '600' },
});
