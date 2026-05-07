import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, TextInput, Modal, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { buildProductUrl, STORES } from '../lib/affiliates';

const LISTS = [
  { key: 'want_to_buy', label: '🛍️ Quiero comprar' },
  { key: 'bought', label: '✅ Compré' },
  { key: 'recommend', label: '👍 Recomiendo' },
  { key: 'not_recommend', label: '👎 No recomiendo' },
];

export default function ProductScreen({ route, navigation }) {
  const { product } = route.params;
  const [adding, setAdding] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState(product.price ? String(Math.round(product.price * 0.9)) : '');
  const [savingAlert, setSavingAlert] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  function showToast(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function addToList(listType) {
    setAdding(true);
    setShowListModal(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let productId = product.id;
      if (!productId) {
        const { data: existing } = await supabase.from('products').select('id').eq('name', product.name).eq('store', product.store || '').single();
        productId = existing?.id;
        if (!productId) {
          const { data: newP } = await supabase.from('products').insert({ name: product.name, brand: product.brand, store: product.store, price: Math.round(product.price || 0), image_emoji: product.image_emoji, image_url: product.image_url, category: product.category }).select('id').single();
          productId = newP?.id;
        }
      }
      await supabase.from('list_items').upsert({ user_id: user.id, product_id: productId, list_type: listType }, { onConflict: 'user_id,product_id,list_type' });
      showToast('✓ Agregado a tu lista');
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  }

  async function saveAlert() {
    if (!targetPrice) return;
    setSavingAlert(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let productId = product.id;
      await supabase.from('price_alerts').insert({ user_id: user.id, product_id: productId, target_price: parseInt(targetPrice.replace(/\D/g, '')) });
      setShowAlertModal(false);
      showToast('🔔 Alerta de precio activada');
    } catch (e) { console.error(e); }
    finally { setSavingAlert(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PriceAlerts')}>
          <Text style={styles.alertsLink}>🔔</Text>
        </TouchableOpacity>
      </View>

      {successMsg ? (
        <View style={styles.toast}><Text style={styles.toastText}>{successMsg}</Text></View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Imagen del producto */}
        <View style={styles.imageWrap}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <Text style={styles.imageEmoji}>{product.image_emoji || '📦'}</Text>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.category}>{product.category} · {product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{product.price ? `$${Math.round(product.price).toLocaleString('es-CL')}` : 'Precio no disponible'}</Text>
          <Text style={styles.store}>Disponible en {product.store}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Comparar precios</Text>
          {STORES.map(({ name, dot }) => {
            const isThisStore = name === product.store;
            const url = buildProductUrl(
              name,
              isThisStore ? (product.permalink || null) : null,
              product.name
            );
            return (
              <TouchableOpacity
                key={name}
                style={[styles.priceRow, isThisStore && styles.priceRowBest]}
                onPress={() => Linking.openURL(url)}
                activeOpacity={0.7}
              >
                <View style={[styles.storeDot, { backgroundColor: dot }]} />
                <Text style={styles.storeName}>{name}</Text>
                {isThisStore
                  ? <Text style={styles.priceBest}>${Math.round(product.price || 0).toLocaleString('es-CL')} 🏆</Text>
                  : <Text style={styles.priceLink}>Buscar →</Text>
                }
              </TouchableOpacity>
            );
          })}
          <Text style={styles.priceNote}>Toca una tienda para ver su precio actual</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowListModal(true)} disabled={adding}>
            {adding ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>🛍️ Agregar a mi lista</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAlert} onPress={() => setShowAlertModal(true)}>
            <Text style={styles.btnAlertText}>🔔 Activar alerta de precio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGift} onPress={() => navigation.navigate('GroupGift', { product })}>
            <Text style={styles.btnGiftText}>🎁 Crear regalo grupal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal agregar a lista */}
      <Modal visible={showListModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowListModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Agregar a lista</Text>
            <Text style={styles.modalProduct} numberOfLines={1}>{product.name}</Text>
            {LISTS.map(list => (
              <TouchableOpacity key={list.key} style={styles.listOption} onPress={() => addToList(list.key)}>
                <Text style={styles.listOptionText}>{list.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowListModal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal alerta de precio */}
      <Modal visible={showAlertModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAlertModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔔 Alerta de precio</Text>
            <Text style={styles.modalProduct}>Te avisamos cuando baje de:</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput style={styles.priceInput} value={targetPrice} onChangeText={setTargetPrice} keyboardType="numeric" placeholder="0" />
            </View>
            <Text style={styles.modalHint}>Precio actual: ${Math.round(product.price || 0).toLocaleString('es-CL')}</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={saveAlert} disabled={savingAlert}>
              {savingAlert ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Activar alerta</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAlertModal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A18' },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A18' },
  alertsLink: { fontSize: 22 },
  toast: { backgroundColor: '#1A1A18', margin: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  toastText: { color: 'white', fontWeight: '600', fontSize: 14 },
  scroll: { paddingBottom: 40 },
  imageWrap: { backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center', paddingVertical: 32, minHeight: 200 },
  productImage: { width: 200, height: 200 },
  imageEmoji: { fontSize: 96 },
  infoSection: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 12 },
  category: { fontSize: 12, color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  name: { fontSize: 22, fontWeight: '700', color: '#1A1A18', marginBottom: 10 },
  price: { fontSize: 32, fontWeight: '700', color: '#D94F3D', marginBottom: 6 },
  store: { fontSize: 13, color: '#8A8A82' },
  section: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A18', marginBottom: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#FAFAF7' },
  priceRowBest: { backgroundColor: '#DCF5EB' },
  storeName: { fontSize: 14, fontWeight: '500', color: '#1A1A18' },
  storeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  priceBest: { fontSize: 14, fontWeight: '700', color: '#2D8C5E' },
  priceOther: { fontSize: 14, color: '#8A8A82' },
  priceLink: { fontSize: 14, color: '#3D7DD9', fontWeight: '500' },
  priceNote: { fontSize: 11, color: '#8A8A82', textAlign: 'center', marginTop: 6 },
  actions: { padding: 20, gap: 10 },
  btnPrimary: { backgroundColor: '#D94F3D', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  btnAlert: { backgroundColor: '#1A1A18', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnAlertText: { color: 'white', fontSize: 15, fontWeight: '600' },
  btnGift: { backgroundColor: '#2D8C5E', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnGiftText: { color: 'white', fontSize: 15, fontWeight: '600' },
  btnSecondary: { borderWidth: 1.5, borderColor: '#1A1A18', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnSecondaryText: { color: '#1A1A18', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, margin: 16, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A18' },
  modalProduct: { fontSize: 13, color: '#8A8A82', marginBottom: 4 },
  listOption: { backgroundColor: '#FAFAF7', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  listOptionText: { fontSize: 15, fontWeight: '500', color: '#1A1A18' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#8A8A82' },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E8E8E2', borderRadius: 14, paddingHorizontal: 16 },
  pricePrefix: { fontSize: 24, fontWeight: '700', color: '#8A8A82', marginRight: 4 },
  priceInput: { flex: 1, fontSize: 32, fontWeight: '700', color: '#1A1A18', paddingVertical: 14 },
  modalHint: { fontSize: 13, color: '#8A8A82' },
});
