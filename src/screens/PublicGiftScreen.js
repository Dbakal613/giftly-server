import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';

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

    const { data: contribs } = await supabase
      .from('group_gift_members')
      .select('id, amount, status, contributor_name, user_id')
      .eq('group_gift_id', giftId)
      .in('status', ['paid', 'accepted']);

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
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!gift) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Feather name="gift" size={36} color={colors.muted} />
        </View>
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
        <View style={styles.successIconWrap}>
          <Feather name="check-circle" size={52} color={colors.green} />
        </View>
        <Text style={styles.successTitle}>¡Aporte registrado!</Text>
        <Text style={styles.successSub}>
          Gracias por contribuir al regalo de {gift.recipient_name}.
          {'\n'}Tu aporte de ${parseInt(amount.replace(/\D/g, ''), 10).toLocaleString('es-CL')} fue recibido.
        </Text>
        {!currentUser && (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnPrimaryText}>Crear cuenta en Giftly</Text>
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
      <View style={styles.header}>
        <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
        {!currentUser ? (
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.loginBtnText}>Ir a la app</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Regalo grupal para</Text>
          <Text style={styles.heroName}>{gift.recipient_name}</Text>
          <Text style={styles.heroOccasion}>{gift.occasion}</Text>
          {gift.message ? <Text style={styles.heroMessage}>"{gift.message}"</Text> : null}
        </View>

        {gift.products && (
          <View style={styles.productCard}>
            {gift.products.image_url ? (
              <Image source={{ uri: gift.products.image_url }} style={styles.productImg} resizeMode="contain" />
            ) : (
              <View style={styles.productIconWrap}>
                <Feather name="package" size={32} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{gift.products.name}</Text>
              <Text style={styles.productStore}>{gift.products.store}</Text>
              <Text style={styles.productPrice}>${Math.round(gift.products.price || 0).toLocaleString('es-CL')}</Text>
            </View>
          </View>
        )}

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressLabelRow}>
              <Feather name="dollar-sign" size={12} color={colors.muted} />
              <Text style={styles.progressLabel}>Recaudado</Text>
            </View>
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

        {contributions.length > 0 && (
          <View style={styles.contribCard}>
            <View style={styles.contribTitleRow}>
              <Feather name="users" size={13} color={colors.muted} />
              <Text style={styles.contribTitle}>
                {contributions.length} aporte{contributions.length !== 1 ? 's' : ''}
              </Text>
            </View>
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

        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { setErrorMsg(''); setShowModal(true); }}>
            <Feather name="gift" size={16} color="white" />
            <Text style={styles.btnPrimaryText}>Aportar al regalo</Text>
          </TouchableOpacity>
          {!currentUser && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnSecondaryText}>Registrarse en Giftly</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

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
                <Text style={styles.btnSecondaryText}>Mejor me registro</Text>
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
  container:        { flex: 1, backgroundColor: colors.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },

  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIconWrap:  { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo:             { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -1 },
  logoBlack:        { color: colors.ink },
  loginBtn:         { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7 },
  loginBtnText:     { fontSize: 13, fontWeight: '600', color: colors.ink },

  scroll:           { padding: 20, gap: 14 },

  heroCard:         { backgroundColor: colors.ink, borderRadius: radius.xl, padding: 24 },
  heroLabel:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroName:         { fontSize: 28, fontWeight: '800', color: colors.surface, marginBottom: 4 },
  heroOccasion:     { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  heroMessage:      { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },

  productCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  productImg:       { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.tagBg },
  productIconWrap:  { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  productName:      { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 3 },
  productStore:     { fontSize: 12, color: colors.muted, marginBottom: 4 },
  productPrice:     { fontSize: 18, fontWeight: '800', color: colors.accent },

  progressCard:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 4 },
  progressRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressLabel:    { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressPctText:  { fontSize: 13, fontWeight: '700', color: colors.green },
  progressAmount:   { fontSize: 34, fontWeight: '800', color: colors.green },
  progressTarget:   { fontSize: 14, color: colors.muted, marginTop: -2 },
  progressBar:      { height: 8, backgroundColor: colors.tagBg, borderRadius: radius.full, overflow: 'hidden', marginTop: 8 },
  progressFill:     { height: '100%', backgroundColor: colors.green, borderRadius: radius.full },

  contribCard:      { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border },
  contribTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  contribTitle:     { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  contribRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.tagBg },
  contribAvatar:    { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  contribAvatarText:{ color: 'white', fontWeight: '700', fontSize: 14 },
  contribName:      { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  contribAmount:    { fontSize: 14, fontWeight: '700', color: colors.green },

  ctaSection:       { gap: 10 },

  errorTitle:       { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 8, textAlign: 'center' },
  errorSub:         { fontSize: 15, color: colors.muted, textAlign: 'center' },
  successTitle:     { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 10, textAlign: 'center' },
  successSub:       { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, margin: 16, gap: 10 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalSub:         { fontSize: 13, color: colors.muted, marginTop: -6 },
  fieldLabel:       { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  input:            { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.bg },
  amountWrap:       { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16 },
  amountPrefix:     { fontSize: 24, fontWeight: '700', color: colors.muted, marginRight: 4 },
  amountInput:      { flex: 1, fontSize: 32, fontWeight: '700', color: colors.ink, paddingVertical: 14 },
  modalHint:        { fontSize: 12, color: colors.muted },
  errorText:        { fontSize: 13, color: colors.accent, fontWeight: '500' },
  btnPrimary:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16 },
  btnPrimaryText:   { color: 'white', fontSize: 16, fontWeight: '700' },
  btnSecondary:     { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cancelBtn:        { padding: 14, alignItems: 'center' },
  cancelText:       { fontSize: 15, color: colors.muted },
});
