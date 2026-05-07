import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const OCCASIONS = ['🎂 Cumpleaños', '🎄 Navidad', '💍 Aniversario', '🎓 Graduación', '🏠 Nuevo hogar', '🎉 Otro'];

export default function GroupGiftScreen({ route, navigation }) {
  const { product } = route.params || {};
  const [step, setStep] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [message, setMessage] = useState('');
  const [myAmount, setMyAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [giftId, setGiftId] = useState(null);

  async function createGift() {
    if (!recipientName) { Alert.alert('Error', 'Ingresa el nombre de quien recibe el regalo'); return; }
    if (!occasion) { Alert.alert('Error', 'Selecciona la ocasión'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'Debes iniciar sesión'); return; }

      let productId = product?.id;
      if (!productId && product) {
        const { data: newP } = await supabase.from('products')
          .insert({ name: product.name, brand: product.brand, store: product.store, price: Math.round(product.price || 0), image_emoji: product.image_emoji, category: product.category })
          .select('id').single();
        productId = newP?.id;
      }

      const { data: gift, error } = await supabase.from('group_gifts').insert({
        creator_id: user.id,
        recipient_name: recipientName,
        product_id: productId,
        occasion: occasion.replace(/^[^ ]+ /, ''),
        message,
        status: 'active',
      }).select('id').single();

      if (error) throw error;
      setGiftId(gift.id);

      if (myAmount) {
        await supabase.from('group_gift_members').insert({
          group_gift_id: gift.id,
          user_id: user.id,
          amount: parseInt(myAmount.replace(/\./g, '')),
          status: 'paid',
        });
      }

      setCreated(true);
      setStep(3);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  if (step === 3 && created) {
    return (
      <View style={styles.container}>
        <View style={styles.successWrap}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>¡Regalo grupal creado!</Text>
          <Text style={styles.successSub}>Comparte el link con tus amigos para que se unan y aporten.</Text>
          <View style={styles.giftSummary}>
            <Text style={styles.summaryLabel}>Para</Text>
            <Text style={styles.summaryValue}>{recipientName}</Text>
            <Text style={styles.summaryLabel}>Ocasión</Text>
            <Text style={styles.summaryValue}>{occasion}</Text>
            {product && <>
              <Text style={styles.summaryLabel}>Producto</Text>
              <Text style={styles.summaryValue}>{product.name}</Text>
              <Text style={styles.summaryLabel}>Precio</Text>
              <Text style={styles.summaryValue}>${Math.round(product.price || 0).toLocaleString('es-CL')}</Text>
            </>}
            {myAmount && <>
              <Text style={styles.summaryLabel}>Tu aporte</Text>
              <Text style={styles.summaryValue} style={{color: '#2D8C5E', fontWeight: '700'}}>${parseInt(myAmount.replace(/\./g, '')).toLocaleString('es-CL')}</Text>
            </>}
          </View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.btnPrimaryText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(step - 1)} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regalo grupal 🎁</Text>
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        {[1, 2].map(s => (
          <View key={s} style={styles.stepWrap}>
            <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
            </View>
            <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
              {s === 1 ? 'Detalles' : 'Tu aporte'}
            </Text>
            {s < 2 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 && (
          <>
            {product && (
              <View style={styles.productCard}>
                <Text style={styles.productEmoji}>{product.image_emoji || '📦'}</Text>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productPrice}>${Math.round(product.price || 0).toLocaleString('es-CL')}</Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>¿Para quién es el regalo?</Text>
              <TextInput style={styles.input} value={recipientName} onChangeText={setRecipientName} placeholder="Nombre de la persona" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ocasión</Text>
              <View style={styles.occasionGrid}>
                {OCCASIONS.map(o => (
                  <TouchableOpacity key={o} style={[styles.occasionBtn, occasion === o && styles.occasionBtnActive]} onPress={() => setOccasion(o)}>
                    <Text style={[styles.occasionText, occasion === o && styles.occasionTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mensaje (opcional)</Text>
              <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} placeholder="¡Feliz cumpleaños! Con cariño..." multiline numberOfLines={3} />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => {
              if (!recipientName) { Alert.alert('Error', 'Ingresa el nombre'); return; }
              if (!occasion) { Alert.alert('Error', 'Selecciona la ocasión'); return; }
              setStep(2);
            }}>
              <Text style={styles.btnPrimaryText}>Continuar →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>Resumen del regalo</Text>
              <Text style={styles.summaryCardItem}>👤 Para: <Text style={{fontWeight:'700'}}>{recipientName}</Text></Text>
              <Text style={styles.summaryCardItem}>🎉 Ocasión: <Text style={{fontWeight:'700'}}>{occasion}</Text></Text>
              {product && <Text style={styles.summaryCardItem}>🛍️ Precio total: <Text style={{fontWeight:'700', color:'#D94F3D'}}>${Math.round(product.price || 0).toLocaleString('es-CL')}</Text></Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>¿Cuánto quieres aportar tú?</Text>
              <View style={styles.amountWrap}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput style={styles.amountInput} value={myAmount} onChangeText={setMyAmount} keyboardType="numeric" placeholder="0" />
              </View>
              {product && <Text style={styles.amountHint}>Sugerido (1/3): ${Math.round((product.price || 0) / 3).toLocaleString('es-CL')}</Text>}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={createGift} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Crear regalo grupal 🎁</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSkip} onPress={createGift} disabled={loading}>
              <Text style={styles.btnSkipText}>Crear sin definir monto ahora</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A18' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#FFFFFF', gap: 0 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#D94F3D' },
  stepNum: { fontSize: 14, fontWeight: '700', color: '#8A8A82' },
  stepNumActive: { color: 'white' },
  stepLabel: { fontSize: 12, color: '#8A8A82', marginLeft: 6 },
  stepLabelActive: { color: '#D94F3D', fontWeight: '600' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E8E8E2', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#D94F3D' },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  productEmoji: { fontSize: 36 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 4 },
  productPrice: { fontSize: 18, fontWeight: '700', color: '#D94F3D' },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A18', backgroundColor: '#FFFFFF' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  occasionBtnActive: { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  occasionText: { fontSize: 13, color: '#8A8A82' },
  occasionTextActive: { color: '#D94F3D', fontWeight: '600' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E8E8E2', gap: 8 },
  summaryCardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A18', marginBottom: 4 },
  summaryCardItem: { fontSize: 14, color: '#8A8A82' },
  amountWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E8E8E2', borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  amountPrefix: { fontSize: 24, fontWeight: '700', color: '#8A8A82', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', color: '#1A1A18', paddingVertical: 14 },
  amountHint: { fontSize: 13, color: '#8A8A82' },
  btnPrimary: { backgroundColor: '#D94F3D', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  btnSkip: { padding: 14, alignItems: 'center' },
  btnSkipText: { fontSize: 14, color: '#8A8A82' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji: { fontSize: 72, marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A18', marginBottom: 10, textAlign: 'center' },
  successSub: { fontSize: 15, color: '#8A8A82', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  giftSummary: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: '#E8E8E2', gap: 6 },
  summaryLabel: { fontSize: 11, color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#1A1A18' },
});
