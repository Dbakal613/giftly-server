import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function PublicGiftScreen({ route, navigation }) {
  const { giftId } = route.params || {};

  const [gift, setGift]               = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading]         = useState(true);

  const [showModal, setShowModal]     = useState(false);
  const [anonName, setAnonName]       = useState('');
  const [amount, setAmount]           = useState('');
  const [saving, setSaving]           = useState(false);
  const [success, setSuccess]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const [currentUser, setCurrentUser]       = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);

  useEffect(() => {
    loadGift();
    checkAuth();
  }, [giftId]);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);
    const { data: profile } = await supabase
      .from('profiles').select('name, username').eq('id', user.id).maybeSingle();
    setCurrentProfile(profile);
  }

  async function loadGift() {
    setLoading(true);
    const { data, error } = await supabase
      .from('group_gifts')
      .select(`*, products(id, name, image_emoji, image_url, price, store, brand)`)
      .eq('id', giftId)
      .single();

    if (error || !data) {
      console.error('load public gift error:', error?.message);
      setLoading(false);
      return;
    }

    // Load contributions (paid or accepted)
    const { data: contribs } = await supabase
      .from('group_gift_members')
      .select('id, amount, status, contributor_name, user_id')
      .eq('group_gift_id', giftId)
      .in('status', ['paid', 'accepted']);

    // Enrich with profiles for registered contributors
    const userIds = (contribs || []).filter(c => c.user_id).map(c => c.user_id);
    let profilesById = {};
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, username').in('id', userIds);
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }

    setContributions((contribs || []).map(c => ({
      ...c,
      displayName: c.user_id
        ? (profilesById[c.user_id]?.name || profilesById[c.user_id]?.username || 'Usuario')
        : (c.contributor_name || 'Anónimo'),
    })));

    setGift(data);
    setLoading(false);
  }

  async function contribute() {
    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsedAmount || parsedAmount <= 0) { setErrorMsg('Ingresa un monto válido'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      if (currentUser) {
        const { error } = await supabase.from('group_gift_members').upsert({
          group_gift_id:    giftId,
          user_id:          currentUser.id,
          amount:           parsedAmount,
          status:           'paid',
          contributor_name: currentProfile?.name || currentProfile?.username || null,
        }, { onConflict: 'group_gift_id,user_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('group_gift_members').insert({
          group_gift_id:    giftId,
          user_id:          null,
          amount:           parsedAmount,
          status:           'paid',
          contributor_name: anonName.trim() || 'Anónimo',
        });
        if (error) throw error;
      }
      setSuccess(true);
      setShowModal(false);
      loadGift();
    } catch (e) {
      setErrorMsg('Error al registrar el aporte: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const totalCollected = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalTarget    = gift?.products?.price || 0;
  const progressPct    = totalTarget > 0 ? Math.min((totalCollected / totalTarget) * 100, 100) : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D94F3D" size="large" />
      </View>
    );
  }

  if (!gift) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
        <Text style={styles.errorTitle}>Regalo no encontrado</Text>
        <Text style={styles.errorSub}>Este link puede ser inválido o el regalo fue eliminado.</Text>
        <TouchableOpacity style={[styles.btnSecondary, { marginTop: 20 }]} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnSecondaryText}>Ir a Giftly</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 72, marginBottom: 20 }}>🎉</Text>
        <Text style={styles.successTitle}>¡Aporte registrado!</Text>
        <Text style={styles.successSub}>
          Gracias por contribuir al regalo de {gift.recipient_name}.
          {'\n'}Tu aporte de ${parseInt(amount.replace(/\D/g, ''), 10).toLocaleString('es-CL')} fue recibido.
        </Text>
        {!currentUser && (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnPrimaryText}>Crear cuenta en Giftly →</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setSuccess(false)}>
          <Text style={styles.cancelText}>Ver el regalo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
        {!currentUser ? (
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.loginBtnText}>Ir a la app →</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Regalo grupal para</Text>
          <Text style={styles.heroName}>{gift.recipient_name}</Text>
          <Text style={styles.heroOccasion}>{gift.occasion}</Text>
          {gift.message ? <Text style={styles.heroMessage}>"{gift.message}"</Text> : null}
        </View>

        {/* Product */}
        {gift.products && (
          <View style={styles.productCard}>
            {gift.products.image_url ? (
              <Image source={{ uri: gift.products.image_url }} style={styles.productImg} resizeMode="contain" />
            ) : (
              <Text style={styles.productEmoji}>{gift.products.image_emoji || '🎁'}</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{gift.products.name}</Text>
              <Text style={styles.productStore}>{gift.products.store}</Text>
              <Text style={styles.productPrice}>${Math.round(gift.products.price || 0).toLocaleString('es-CL')}</Text>
            </View>
          </View>
        )}

        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>💰 Recaudado</Text>
            {totalTarget > 0 && <Text style={styles.progressPctText}>{Math.round(progressPct)}%</Text>}
          </View>
          <Text style={styles.progressAmount}>${totalCollected.toLocaleString('es-CL')}</Text>
          {totalTarget > 0 && (
            <Text style={styles.progressTarget}>de ${totalTarget.toLocaleString('es-CL')}</Text>
          )}
          {totalTarget > 0 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          )}
        </View>

        {/* Contributors */}
        {contributions.length > 0 && (
          <View style={styles.contribCard}>
            <Text style={styles.contribTitle}>
              👥 {contributions.length} aporte{contributions.length !== 1 ? 's' : ''}
            </Text>
            {contributions.map((c, i) => (
              <View key={c.id || i} style={styles.contribRow}>
                <View style={styles.contribAvatar}>
                  <Text style={styles.contribAvatarText}>
                    {(c.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.contribName}>{c.displayName}</Text>
                <Text style={styles.contribAmount}>${(c.amount || 0).toLocaleString('es-CL')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { setErrorMsg(''); setShowModal(true); }}>
            <Text style={styles.btnPrimaryText}>🎁 Aportar al regalo</Text>
          </TouchableOpacity>
          {!currentUser && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnSecondaryText}>Registrarse en Giftly</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Contribution modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            {currentUser ? (
              <>
                <Text style={styles.modalTitle}>Tu aporte</Text>
                <Text style={styles.modalSub}>
                  Como {currentProfile?.name || currentProfile?.username || 'tú'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Aportar al regalo</Text>
                <Text style={styles.fieldLabel}>Tu nombre (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={anonName}
                  onChangeText={setAnonName}
                  placeholder="Ej: María, La abuela, Anónimo..."
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Monto a aportar</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            {totalTarget > 0 && (
              <Text style={styles.modalHint}>
                Falta: ${Math.max(0, totalTarget - totalCollected).toLocaleString('es-CL')}
              </Text>
            )}

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
              onPress={contribute}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnPrimaryText}>Confirmar aporte</Text>}
            </TouchableOpacity>

            {!currentUser && (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => { setShowModal(false); navigation.navigate('Login'); }}
              >
                <Text style={styles.btnSecondaryText}>Mejor me registro →</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#FAFAF7' },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAFAF7' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  logo:             { fontSize: 26, fontWeight: '800', color: '#D94F3D', letterSpacing: -1 },
  logoBlack:        { color: '#1A1A18' },
  loginBtn:         { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 7 },
  loginBtnText:     { fontSize: 13, fontWeight: '600', color: '#1A1A18' },

  scroll:           { padding: 20, gap: 14 },

  heroCard:         { backgroundColor: '#1A1A18', borderRadius: 20, padding: 24 },
  heroLabel:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroName:         { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  heroOccasion:     { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  heroMessage:      { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },

  productCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  productImg:       { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F0EFE8' },
  productEmoji:     { fontSize: 40, width: 72, textAlign: 'center' },
  productName:      { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 3 },
  productStore:     { fontSize: 12, color: '#8A8A82', marginBottom: 4 },
  productPrice:     { fontSize: 18, fontWeight: '800', color: '#D94F3D' },

  progressCard:     { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E8E8E2', gap: 4 },
  progressRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel:    { fontSize: 12, fontWeight: '700', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressPctText:  { fontSize: 13, fontWeight: '700', color: '#2D8C5E' },
  progressAmount:   { fontSize: 34, fontWeight: '800', color: '#2D8C5E' },
  progressTarget:   { fontSize: 14, color: '#8A8A82', marginTop: -2 },
  progressBar:      { height: 8, backgroundColor: '#F0EFE8', borderRadius: 100, overflow: 'hidden', marginTop: 8 },
  progressFill:     { height: '100%', backgroundColor: '#2D8C5E', borderRadius: 100 },

  contribCard:      { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E8E8E2' },
  contribTitle:     { fontSize: 12, fontWeight: '700', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  contribRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F8F8F5' },
  contribAvatar:    { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center' },
  contribAvatarText:{ color: 'white', fontWeight: '700', fontSize: 14 },
  contribName:      { flex: 1, fontSize: 14, fontWeight: '500', color: '#1A1A18' },
  contribAmount:    { fontSize: 14, fontWeight: '700', color: '#2D8C5E' },

  ctaSection:       { gap: 10 },

  errorTitle:       { fontSize: 22, fontWeight: '700', color: '#1A1A18', marginBottom: 8, textAlign: 'center' },
  errorSub:         { fontSize: 15, color: '#8A8A82', textAlign: 'center' },
  successTitle:     { fontSize: 26, fontWeight: '700', color: '#1A1A18', marginBottom: 10, textAlign: 'center' },
  successSub:       { fontSize: 15, color: '#8A8A82', textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, margin: 16, gap: 10 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: '#1A1A18' },
  modalSub:         { fontSize: 13, color: '#8A8A82', marginTop: -6 },
  fieldLabel:       { fontSize: 11, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1 },
  input:            { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A18', backgroundColor: '#FAFAF7' },
  amountWrap:       { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E8E8E2', borderRadius: 14, paddingHorizontal: 16 },
  amountPrefix:     { fontSize: 24, fontWeight: '700', color: '#8A8A82', marginRight: 4 },
  amountInput:      { flex: 1, fontSize: 32, fontWeight: '700', color: '#1A1A18', paddingVertical: 14 },
  modalHint:        { fontSize: 12, color: '#8A8A82' },
  errorText:        { fontSize: 13, color: '#D94F3D', fontWeight: '500' },
  btnPrimary:       { backgroundColor: '#D94F3D', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText:   { color: 'white', fontSize: 16, fontWeight: '700' },
  btnSecondary:     { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 14, padding: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600', color: '#1A1A18' },
  cancelBtn:        { padding: 14, alignItems: 'center' },
  cancelText:       { fontSize: 15, color: '#8A8A82' },
});
