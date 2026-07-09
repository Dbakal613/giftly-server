import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, TextInput, Modal, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { formatPrice } from '../data/products';
import { getCurrentUser } from '../services/auth';
import { fetchUserWishlistsBasic, addWishlistItem } from '../services/wishlists';
import { upsertProduct } from '../services/products';
import { createAlert } from '../services/alerts';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';

export default function ProductScreen({ route, navigation }) {
  const { product } = route.params;

  const { toast, showToast } = useToast();
  const [adding, setAdding]               = useState(false);
  const [showListModal, setShowListModal]  = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [wishlists, setWishlists]         = useState([]);
  const [loadingLists, setLoadingLists]   = useState(false);
  const [targetPrice, setTargetPrice]     = useState(
    product.price ? String(Math.round(product.price * 0.9)) : ''
  );
  const [savingAlert, setSavingAlert] = useState(false);

  async function openSaveModal() {
    setShowListModal(true);
    setLoadingLists(true);
    const user = await getCurrentUser();
    if (user) {
      const { data } = await fetchUserWishlistsBasic(user.id);
      setWishlists(data || []);
    }
    setLoadingLists(false);
  }

  async function handleSaveToWishlist(wishlistId, wishlistTitle) {
    setAdding(true);
    setShowListModal(false);
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const productId = product.id ?? await upsertProduct(product);
      const { error } = await addWishlistItem({ wishlistId, productId });
      if (error && error.code !== '23505') throw error;
      showToast(`Guardado en "${wishlistTitle}"`);
    } catch (e) {
      showToast('Error al guardar');
      console.error(e);
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveAlert() {
    if (!targetPrice) return;
    setSavingAlert(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;
      await createAlert({
        userId:      user.id,
        productId:   product.id,
        targetPrice: parseInt(targetPrice.replace(/\D/g, '')),
      });
      setShowAlertModal(false);
      showToast('Alerta de precio activada');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAlert(false);
    }
  }

  const priceStr = product.price
    ? (typeof product.currency !== 'undefined'
        ? formatPrice(product.price, product.currency)
        : `$${Math.round(product.price).toLocaleString('es-CL')}`)
    : null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={product.name}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => setShowAlertModal(true)} style={styles.headerIconBtn}>
            <Feather name="bell" size={19} color={colors.ink} />
          </TouchableOpacity>
        }
      />

      <Toast message={toast} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.imageWrap}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <Feather name="package" size={64} color={colors.muted} />
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.category}>
            {product.category}{product.brand ? ` · ${product.brand}` : ''}
          </Text>
          <Text style={styles.name}>{product.name}</Text>
          {priceStr ? <Text style={styles.price}>{priceStr}</Text> : null}
          {product.store ? <Text style={styles.store}>Disponible en {product.store}</Text> : null}
        </View>

        {product.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descText}>{product.description}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={openSaveModal} disabled={adding} activeOpacity={0.85}>
            {adding
              ? <ActivityIndicator color="white" />
              : <>
                  <Feather name="heart" size={16} color="white" />
                  <Text style={styles.btnPrimaryText}>Guardar en wishlist</Text>
                </>
            }
          </TouchableOpacity>

          {(product.external_url || product.permalink) ? (
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => Linking.openURL(product.external_url || product.permalink)}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={15} color={colors.ink} />
              <Text style={styles.btnOutlineText}>
                Ver en {product.source_marketplace || product.store || 'tienda'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Save to wishlist modal ── */}
      <Modal visible={showListModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowListModal(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Guardar en wishlist</Text>
            <Text style={styles.modalSub} numberOfLines={1}>{product.name}</Text>

            {loadingLists ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : wishlists.length === 0 ? (
              <EmptyState
                icon="list"
                title="Aún no tienes wishlists"
                text="Crea tu primera lista en Inicio y luego vuelve."
                cta={{ label: 'Ir a Inicio', onPress: () => { setShowListModal(false); navigation.navigate('Home'); } }}
              />
            ) : (
              wishlists.map(wl => (
                <TouchableOpacity
                  key={wl.id}
                  style={styles.wishlistOption}
                  onPress={() => handleSaveToWishlist(wl.id, wl.title)}
                >
                  <View style={styles.wishlistOptionIcon}>
                    <Feather name="list" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.wishlistOptionText}>{wl.title}</Text>
                  <Feather name="chevron-right" size={16} color={colors.muted} />
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowListModal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Price alert modal ── */}
      <Modal visible={showAlertModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowAlertModal(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Feather name="bell" size={18} color={colors.ink} />
              <Text style={styles.modalTitle}>Alerta de precio</Text>
            </View>
            <Text style={styles.modalSub}>Te avisamos cuando baje de:</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={targetPrice}
                onChangeText={setTargetPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
            </View>
            <Text style={styles.priceHint}>Precio actual: {priceStr || 'no disponible'}</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveAlert} disabled={savingAlert}>
              {savingAlert
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnPrimaryText}>Activar alerta</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAlertModal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  scroll:       { paddingBottom: 48 },
  imageWrap:    { backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, minHeight: 220 },
  productImage: { width: 220, height: 220 },

  infoSection:  { backgroundColor: colors.surface, padding: 20, marginBottom: 1 },
  category:     { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  name:         { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 10, letterSpacing: -0.3, lineHeight: 28 },
  price:        { fontSize: 30, fontWeight: '800', color: colors.accent, marginBottom: 6, letterSpacing: -0.5 },
  store:        { fontSize: 13, color: colors.muted },

  descSection:  { backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 1 },
  descText:     { fontSize: 14, color: colors.muted, lineHeight: 22 },

  actions:      { padding: 20, gap: 10 },
  btnPrimary:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16 },
  btnPrimaryText: { color: 'white', fontSize: 15, fontWeight: '700' },
  btnOutline:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 15, backgroundColor: colors.surface },
  btnOutlineText: { color: colors.ink, fontSize: 14, fontWeight: '500' },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingTop: 16, gap: 10 },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalSub:      { fontSize: 13, color: colors.muted },
  modalLoading:  { paddingVertical: 24, alignItems: 'center' },

  wishlistOption:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  wishlistOptionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  wishlistOptionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },

  cancelBtn:     { padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: colors.muted },

  priceInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, backgroundColor: colors.bg },
  pricePrefix:    { fontSize: 24, fontWeight: '700', color: colors.muted, marginRight: 4 },
  priceInput:     { flex: 1, fontSize: 32, fontWeight: '700', color: colors.ink, paddingVertical: 14 },
  priceHint:      { fontSize: 13, color: colors.muted },
});
