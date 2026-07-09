import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, FlatList, Platform, Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';
import { createNotification } from '../lib/notificationHelpers';
import ScreenHeader from '../components/ScreenHeader';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const OCCASIONS = [
  { key: 'Cumpleaños',  icon: 'calendar' },
  { key: 'Navidad',     icon: 'gift' },
  { key: 'Aniversario', icon: 'heart' },
  { key: 'Graduación',  icon: 'award' },
  { key: 'Nuevo hogar', icon: 'home' },
  { key: 'Otro',        icon: 'more-horizontal' },
];

const STATUS_LABEL = {
  paid:     { label: 'Pagado',     color: colors.green,  bg: colors.greenBg },
  accepted: { label: 'Confirmado', color: colors.blue,   bg: colors.blueBg },
  pending:  { label: 'Pendiente',  color: '#E8A020',     bg: '#FFF8E6' },
  invited:  { label: 'Invitado',   color: colors.muted,  bg: colors.tagBg },
  declined: { label: 'Declinó',    color: '#B0AFA8',     bg: colors.tagBg },
};

export default function GroupGiftScreen({ route, navigation }) {
  const { giftId, product: initialProduct, openInviteOnLoad } = route.params || {};
  const isManagement = !!giftId;
  const { toast, showToast } = useToast();

  const [myId, setMyId]           = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  // Management state
  const [giftData, setGiftData]       = useState(null);
  const [loadingGift, setLoadingGift] = useState(isManagement);

  // Invite modal
  const [showInvite, setShowInvite]         = useState(false);
  const [friends, setFriends]               = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit]         = useState(false);
  const [editRecipient, setEditRecipient] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editMessage, setEditMessage]   = useState('');
  const [savingEdit, setSavingEdit]     = useState(false);

  // Amount modal
  const [showAmount, setShowAmount]         = useState(false);
  const [myContribution, setMyContribution] = useState('');
  const [savingAmount, setSavingAmount]     = useState(false);

  // Creation state
  const [step, setStep]               = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [occasion, setOccasion]       = useState('');
  const [message, setMessage]         = useState('');
  const [myAmount, setMyAmount]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [created, setCreated]         = useState(false);
  const [createdGiftId, setCreatedGiftId] = useState(null);
  const [createError, setCreateError] = useState('');

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (openInviteOnLoad && giftData && myId) openInvite();
  }, [openInviteOnLoad, giftData, myId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    setMyId(user.id);
    const { data: profile } = await supabase
      .from('profiles').select('name, username').eq('id', user.id).maybeSingle();
    setMyProfile(profile);
    if (isManagement) fetchGiftData(user.id);
  }

  async function fetchGiftData() {
    setLoadingGift(true);
    const { data: giftRaw, error: giftErr } = await supabase
      .from('group_gifts')
      .select(`*, products(id, name, image_emoji, image_url, price, store, brand)`)
      .eq('id', giftId)
      .single();

    if (giftErr || !giftRaw) {
      setGiftData(null);
      setLoadingGift(false);
      return;
    }

    const { data: membersRaw } = await supabase
      .from('group_gift_members')
      .select('id, amount, status, joined_at, user_id')
      .eq('group_gift_id', giftId);

    const members = membersRaw || [];
    const memberIds = members.map(m => m.user_id);
    let profilesById = {};
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, username').in('id', memberIds);
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }

    setGiftData({
      ...giftRaw,
      group_gift_members: members.map(m => ({ ...m, profiles: profilesById[m.user_id] || null })),
    });
    setLoadingGift(false);
  }

  async function shareGift() {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://giftly-server.vercel.app';
    const url = `${base}/gift/${giftId}`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(url); showToast('Link copiado'); }
      catch { showToast(url); }
    } else {
      try { await Share.share({ message: `Regalo para ${giftData?.recipient_name}: ${url}`, url }); }
      catch (e) { console.warn('share error:', e); }
    }
  }

  async function openInvite() {
    setShowInvite(true);
    setLoadingFriends(true);
    const { data } = await supabase
      .from('friendships').select('friend_id').eq('user_id', myId).eq('status', 'accepted');
    const memberIds = new Set((giftData?.group_gift_members || []).map(m => m.user_id));
    const friendIds = (data || []).map(f => f.friend_id).filter(id => !memberIds.has(id));
    if (!friendIds.length) { setFriends([]); setSelectedFriends(new Set()); setLoadingFriends(false); return; }
    const { data: profiles } = await supabase.from('profiles').select('id, name, username').in('id', friendIds);
    setFriends(profiles || []);
    setSelectedFriends(new Set());
    setLoadingFriends(false);
  }

  function toggleFriend(id) {
    setSelectedFriends(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function sendInvites() {
    if (selectedFriends.size === 0) return;
    setSendingInvites(true);
    try {
      for (const friendId of selectedFriends) {
        await supabase.from('group_gift_members').upsert(
          { group_gift_id: giftId, user_id: friendId, amount: 0, status: 'invited' },
          { onConflict: 'group_gift_id,user_id' }
        );
        createNotification({
          userId: friendId, fromUserId: myId, type: 'gift_invite',
          data: { name: myProfile?.name || myProfile?.username || 'Alguien', gift_id: giftId, recipient_name: giftData?.recipient_name, occasion: giftData?.occasion, product_name: giftData?.products?.name },
        }).catch(() => {});
      }
      setShowInvite(false);
      setSelectedFriends(new Set());
      const n = selectedFriends.size;
      showToast(`${n} invitación${n !== 1 ? 'es' : ''} enviada${n !== 1 ? 's' : ''}`);
      fetchGiftData();
    } catch (e) { console.error('sendInvites error:', e); }
    finally { setSendingInvites(false); }
  }

  function openEdit() {
    setEditRecipient(giftData?.recipient_name || '');
    setEditOccasion(giftData?.occasion || '');
    setEditMessage(giftData?.message || '');
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editRecipient.trim()) return;
    setSavingEdit(true);
    try {
      await supabase.from('group_gifts').update({
        recipient_name: editRecipient.trim(), occasion: editOccasion, message: editMessage.trim(),
      }).eq('id', giftId);
      setShowEdit(false);
      fetchGiftData();
    } catch (e) { console.error('saveEdit error:', e); }
    finally { setSavingEdit(false); }
  }

  async function saveAmount() {
    const amount = parseInt(myContribution.replace(/\D/g, ''), 10);
    if (!amount) return;
    setSavingAmount(true);
    try {
      const myMember = (giftData?.group_gift_members || []).find(m => m.user_id === myId);
      if (myMember) {
        await supabase.from('group_gift_members').update({ amount, status: 'paid' }).eq('id', myMember.id);
      } else {
        await supabase.from('group_gift_members').insert({ group_gift_id: giftId, user_id: myId, amount, status: 'paid' });
      }
      setShowAmount(false);
      setMyContribution('');
      fetchGiftData();
    } catch (e) { console.error('saveAmount error:', e); }
    finally { setSavingAmount(false); }
  }

  async function createGift() {
    if (!recipientName || !occasion) return;
    setLoading(true);
    setCreateError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let productId = initialProduct?.id;
      if (!productId && initialProduct) {
        const { data: newP, error: prodErr } = await supabase.from('products').insert({
          name: initialProduct.name, brand: initialProduct.brand || '', store: initialProduct.store || '',
          price: Math.round(initialProduct.price || 0), image_url: initialProduct.image_url || null, category: initialProduct.category || '',
        }).select('id').single();
        if (!prodErr) productId = newP?.id;
      }

      const { data: gift, error } = await supabase.from('group_gifts').insert({
        creator_id: user.id, recipient_name: recipientName, product_id: productId || null,
        occasion, message, status: 'active',
      }).select('id').single();

      if (error) throw error;
      setCreatedGiftId(gift.id);

      if (myAmount) {
        await supabase.from('group_gift_members').insert({
          group_gift_id: gift.id, user_id: user.id,
          amount: parseInt(myAmount.replace(/\D/g, ''), 10), status: 'paid',
        });
      }

      setCreated(true);
      setStep(3);
    } catch (e) {
      console.error('createGift error:', e);
      setCreateError(e.message || 'Error al crear el regalo. Intenta de nuevo.');
    }
    finally { setLoading(false); }
  }

  // ── MANAGEMENT VIEW ─────────────────────────────────────────────────────────

  if (isManagement) {
    if (loadingGift) {
      return (
        <View style={styles.container}>
          <ScreenHeader title="Regalo grupal" onBack={() => navigation.goBack()} />
          <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
        </View>
      );
    }

    if (!giftData) {
      return (
        <View style={styles.container}>
          <ScreenHeader title="Regalo grupal" onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <Feather name="alert-circle" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>No se pudo cargar</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchGiftData}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const isCreator   = giftData.creator_id === myId;
    const allMembers  = giftData.group_gift_members || [];
    const activeMembers = allMembers.filter(m => ['pending', 'paid', 'accepted'].includes(m.status));
    const myMembership  = allMembers.find(m => m.user_id === myId);
    const isMember      = !!myMembership && myMembership.status !== 'declined' && myMembership.status !== 'invited';
    const totalCollected = activeMembers.reduce((s, m) => s + (m.amount || 0), 0);
    const totalTarget    = giftData.products?.price || 0;
    const progressPct    = totalTarget > 0 ? Math.min((totalCollected / totalTarget) * 100, 100) : 0;
    const needsAmount    = isMember && (!myMembership?.amount || myMembership.amount === 0);

    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Regalo grupal"
          onBack={() => navigation.goBack()}
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={shareGift} style={styles.headerBtn}>
                <Feather name="share-2" size={16} color={colors.ink} />
              </TouchableOpacity>
              {isCreator && (
                <TouchableOpacity onPress={openEdit} style={styles.headerBtn}>
                  <Feather name="edit-2" size={16} color={colors.ink} />
                </TouchableOpacity>
              )}
            </View>
          }
        />

        <Toast message={toast} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Para</Text>
            <Text style={styles.summaryName}>{giftData.recipient_name}</Text>
            <Text style={styles.summaryOccasion}>{giftData.occasion}</Text>
            {giftData.message ? <Text style={styles.summaryMessage}>"{giftData.message}"</Text> : null}
          </View>

          {giftData.products && (
            <View style={styles.productCard}>
              <View style={styles.productImgWrap}>
                <Feather name="package" size={28} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={2}>{giftData.products.name}</Text>
                <Text style={styles.productStore}>{giftData.products.store}</Text>
              </View>
              <Text style={styles.productPrice}>${Math.round(giftData.products.price || 0).toLocaleString('es-CL')}</Text>
            </View>
          )}

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionLabel}>Recaudado</Text>
              {totalTarget > 0 && (
                <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
              )}
            </View>
            <Text style={styles.progressCollected}>${totalCollected.toLocaleString('es-CL')}</Text>
            {totalTarget > 0 && <Text style={styles.progressTarget}>de ${totalTarget.toLocaleString('es-CL')}</Text>}
            {totalTarget > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            )}
          </View>

          <View style={styles.membersCard}>
            <View style={styles.membersTitleRow}>
              <Text style={styles.sectionLabel}>Participantes</Text>
              <Text style={styles.membersCount}>{activeMembers.length}</Text>
            </View>
            {allMembers.filter(m => m.status !== 'declined').map(member => {
              const statusInfo = STATUS_LABEL[member.status] || STATUS_LABEL.pending;
              const displayName = member.profiles?.name || member.profiles?.username || 'Usuario';
              return (
                <View key={member.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, member.user_id === giftData.creator_id && styles.memberAvatarCreator]}>
                    <Text style={styles.memberAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{displayName}</Text>
                      {member.user_id === giftData.creator_id && (
                        <Feather name="shield" size={11} color={colors.muted} />
                      )}
                      {member.user_id === myId && <Text style={styles.youBadge}>Tú</Text>}
                    </View>
                    {member.amount > 0 && (
                      <Text style={styles.memberAmount}>${(member.amount || 0).toLocaleString('es-CL')}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                  </View>
                </View>
              );
            })}
            {allMembers.filter(m => m.status !== 'declined').length === 0 && (
              <Text style={styles.noMembers}>Aún no hay participantes. Invita a tus amigos.</Text>
            )}
          </View>

          {needsAmount && (
            <TouchableOpacity style={styles.amountPrompt} onPress={() => setShowAmount(true)}>
              <Feather name="dollar-sign" size={16} color="#E8A020" />
              <Text style={styles.amountPromptText}>Definir mi aporte</Text>
              <Feather name="chevron-right" size={16} color="#E8A020" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
            <Feather name="user-plus" size={16} color="white" />
            <Text style={styles.inviteBtnText}>Invitar amigos</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>

        <Modal visible={showInvite} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Invitar amigos</Text>
              <Text style={styles.modalSub}>Solo amigos que aún no están en el regalo</Text>
              {loadingFriends ? (
                <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
              ) : friends.length === 0 ? (
                <Text style={styles.noFriendsText}>No hay amigos disponibles para invitar</Text>
              ) : (
                <FlatList
                  data={friends}
                  keyExtractor={f => f.id}
                  style={{ maxHeight: 280 }}
                  renderItem={({ item }) => {
                    const sel = selectedFriends.has(item.id);
                    return (
                      <TouchableOpacity style={styles.friendRow} onPress={() => toggleFriend(item.id)}>
                        <View style={styles.friendAvatar}>
                          <Text style={styles.friendAvatarText}>{(item.name || item.username || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{item.name || 'Sin nombre'}</Text>
                          <Text style={styles.friendUser}>@{item.username}</Text>
                        </View>
                        <View style={[styles.checkbox, sel && styles.checkboxChecked]}>
                          {sel && <Feather name="check" size={12} color="white" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              <TouchableOpacity
                style={[styles.btnPrimary, (selectedFriends.size === 0 || sendingInvites) && styles.btnDisabled]}
                onPress={sendInvites}
                disabled={selectedFriends.size === 0 || sendingInvites}
              >
                {sendingInvites
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.btnPrimaryText}>Invitar{selectedFriends.size > 0 ? ` (${selectedFriends.size})` : ''}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showEdit} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Editar regalo</Text>
              <Text style={styles.fieldLabel}>Para quién</Text>
              <TextInput style={styles.input} value={editRecipient} onChangeText={setEditRecipient} placeholder="Nombre de quien recibe" placeholderTextColor={colors.muted} />
              <Text style={styles.fieldLabel}>Ocasión</Text>
              <View style={styles.occasionGrid}>
                {OCCASIONS.map(o => (
                  <TouchableOpacity key={o.key} style={[styles.occasionBtn, editOccasion === o.key && styles.occasionBtnActive]} onPress={() => setEditOccasion(o.key)}>
                    <Feather name={o.icon} size={13} color={editOccasion === o.key ? colors.accent : colors.muted} />
                    <Text style={[styles.occasionText, editOccasion === o.key && styles.occasionTextActive]}>{o.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Mensaje (opcional)</Text>
              <TextInput style={[styles.input, styles.textarea]} value={editMessage} onChangeText={setEditMessage} placeholder="Un mensaje especial..." multiline numberOfLines={3} placeholderTextColor={colors.muted} />
              <TouchableOpacity style={[styles.btnPrimary, (!editRecipient.trim() || savingEdit) && styles.btnDisabled]} onPress={saveEdit} disabled={!editRecipient.trim() || savingEdit}>
                {savingEdit ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showAmount} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAmount(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Mi aporte</Text>
              <Text style={styles.modalSub}>¿Cuánto quieres aportar a este regalo?</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput style={styles.amountInput} value={myContribution} onChangeText={setMyContribution} keyboardType="numeric" placeholder="0" autoFocus placeholderTextColor={colors.muted} />
              </View>
              {giftData.products && (
                <Text style={styles.amountHint}>Sugerido (1/3): ${Math.round((giftData.products.price || 0) / 3).toLocaleString('es-CL')}</Text>
              )}
              <TouchableOpacity style={[styles.btnPrimary, (!myContribution || savingAmount) && styles.btnDisabled]} onPress={saveAmount} disabled={!myContribution || savingAmount}>
                {savingAmount ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Confirmar aporte</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAmount(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ── SUCCESS SCREEN ───────────────────────────────────────────────────────────

  if (step === 3 && created) {
    return (
      <View style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <Feather name="check-circle" size={52} color={colors.green} />
          </View>
          <Text style={styles.successTitle}>Regalo grupal creado</Text>
          <Text style={styles.successSub}>Invita a tus amigos para que se unan y aporten.</Text>
          <View style={styles.giftSummary}>
            <SummaryRow label="Para" value={recipientName} />
            <SummaryRow label="Ocasión" value={occasion} />
            {initialProduct && <SummaryRow label="Producto" value={initialProduct.name} />}
            {initialProduct && <SummaryRow label="Precio" value={`$${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}`} accent />}
            {myAmount && <SummaryRow label="Tu aporte" value={`$${parseInt(myAmount.replace(/\D/g, ''), 10).toLocaleString('es-CL')}`} green />}
          </View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('GroupGift', { giftId: createdGiftId, openInviteOnLoad: true })}>
            <Feather name="user-plus" size={16} color="white" />
            <Text style={styles.btnPrimaryText}>Invitar amigos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('GroupGift', { giftId: createdGiftId })}>
            <Text style={styles.btnOutlineText}>Ver el regalo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.cancelBtnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── CREATION FLOW ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Nuevo regalo grupal"
        onBack={() => step === 1 ? navigation.goBack() : setStep(step - 1)}
      />

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
            {initialProduct && (
              <View style={styles.productCard}>
                <View style={styles.productImgWrap}>
                  <Feather name="package" size={24} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{initialProduct.name}</Text>
                  <Text style={styles.productPrice}>${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}</Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Para quién es el regalo</Text>
              <TextInput style={styles.input} value={recipientName} onChangeText={setRecipientName} placeholder="Nombre de la persona" placeholderTextColor={colors.muted} />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Ocasión</Text>
              <View style={styles.occasionGrid}>
                {OCCASIONS.map(o => (
                  <TouchableOpacity key={o.key} style={[styles.occasionBtn, occasion === o.key && styles.occasionBtnActive]} onPress={() => setOccasion(o.key)}>
                    <Feather name={o.icon} size={13} color={occasion === o.key ? colors.accent : colors.muted} />
                    <Text style={[styles.occasionText, occasion === o.key && styles.occasionTextActive]}>{o.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mensaje (opcional)</Text>
              <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} placeholder="Con mucho cariño..." multiline numberOfLines={3} placeholderTextColor={colors.muted} />
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, (!recipientName.trim() || !occasion) && styles.btnDisabled]}
              onPress={() => { if (!recipientName.trim() || !occasion) return; setStep(2); }}
            >
              <Text style={styles.btnPrimaryText}>Continuar</Text>
              <Feather name="arrow-right" size={16} color="white" />
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.createSummaryCard}>
              <Text style={styles.createSummaryTitle}>Resumen del regalo</Text>
              <SummaryRow label="Para" value={recipientName} />
              <SummaryRow label="Ocasión" value={occasion} />
              {initialProduct && <SummaryRow label="Precio total" value={`$${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}`} accent />}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tu aporte (opcional)</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput style={styles.amountInput} value={myAmount} onChangeText={setMyAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              </View>
              {initialProduct && (
                <Text style={styles.amountHint}>Sugerido (1/3): ${Math.round((initialProduct.price || 0) / 3).toLocaleString('es-CL')}</Text>
              )}
            </View>

            {createError ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>{createError}</Text></View>
            ) : null}

            <TouchableOpacity style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={createGift} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : (
                <>
                  <Feather name="gift" size={16} color="white" />
                  <Text style={styles.btnPrimaryText}>Crear regalo grupal</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={createGift} disabled={loading}>
              <Text style={styles.cancelBtnText}>Crear sin definir monto ahora</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, accent, green }) {
  return (
    <View style={srStyles.row}>
      <Text style={srStyles.label}>{label}</Text>
      <Text style={[srStyles.value, accent && { color: colors.accent }, green && { color: colors.green }]}>{value}</Text>
    </View>
  );
}

const srStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.tagBg },
  label: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  value: { fontSize: 14, color: colors.ink, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  retryBtn:   { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: 'white', fontWeight: '600' },

  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 20, gap: 14, paddingBottom: 40 },

  summaryCard:    { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20 },
  summaryLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  summaryName:    { fontSize: 24, fontWeight: '800', color: 'white', letterSpacing: -0.5 },
  summaryOccasion:{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  summaryMessage: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginTop: 8 },

  productCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  productImgWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  productName:    { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  productStore:   { fontSize: 12, color: colors.muted },
  productPrice:   { fontSize: 18, fontWeight: '800', color: colors.accent },

  progressCard:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 8 },
  progressHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  progressPct:      { fontSize: 13, fontWeight: '700', color: colors.green },
  progressCollected:{ fontSize: 32, fontWeight: '800', color: colors.green, letterSpacing: -1 },
  progressTarget:   { fontSize: 14, color: colors.muted },
  progressBar:      { height: 6, backgroundColor: colors.tagBg, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: colors.green, borderRadius: radius.full },

  membersCard:      { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 2 },
  membersTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  membersCount:     { fontSize: 13, fontWeight: '700', color: colors.ink },
  noMembers:        { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 12 },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.tagBg },
  memberAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  memberAvatarCreator: { backgroundColor: colors.ink },
  memberAvatarText: { color: 'white', fontWeight: '700', fontSize: 15 },
  memberNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  memberName:       { fontSize: 14, fontWeight: '600', color: colors.ink },
  youBadge:         { fontSize: 10, color: colors.accent, fontWeight: '700', backgroundColor: colors.redBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  memberAmount:     { fontSize: 13, color: colors.muted, marginTop: 1 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  statusText:       { fontSize: 11, fontWeight: '600' },

  amountPrompt:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF8E6', borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: '#F5C842' },
  amountPromptText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#E8A020' },

  inviteBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radius.md, padding: 16 },
  inviteBtnText:    { color: 'white', fontSize: 15, fontWeight: '700' },

  // Steps
  steps:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepWrap:     { flexDirection: 'row', alignItems: 'center' },
  stepDot:      { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:{ backgroundColor: colors.accent },
  stepNum:      { fontSize: 14, fontWeight: '700', color: colors.muted },
  stepNumActive:{ color: 'white' },
  stepLabel:    { fontSize: 12, color: colors.muted, marginLeft: 6 },
  stepLabelActive: { color: colors.accent, fontWeight: '600' },
  stepLine:     { width: 40, height: 2, backgroundColor: colors.border, marginHorizontal: 8 },
  stepLineActive: { backgroundColor: colors.accent },

  field:        { gap: 8 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  input:        { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  textarea:     { minHeight: 80, textAlignVertical: 'top' },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  occasionBtnActive: { borderColor: colors.accent, backgroundColor: colors.redBg },
  occasionText: { fontSize: 13, color: colors.muted },
  occasionTextActive: { color: colors.accent, fontWeight: '600' },

  createSummaryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 4 },
  createSummaryTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 8 },

  errorBox:  { backgroundColor: colors.redBg, borderRadius: radius.sm, padding: 12, borderWidth: 1, borderColor: colors.accentLight },
  errorText: { color: colors.accent, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.md, padding: 16 },
  btnPrimaryText: { color: 'white', fontSize: 15, fontWeight: '700' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 15, alignItems: 'center', backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  btnDisabled: { opacity: 0.45 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: colors.muted },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingTop: 16, gap: 12 },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalSub:     { fontSize: 13, color: colors.muted },
  noFriendsText: { fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  friendRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.tagBg },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { color: 'white', fontWeight: '700', fontSize: 15 },
  friendName:   { fontSize: 14, fontWeight: '600', color: colors.ink },
  friendUser:   { fontSize: 12, color: colors.muted },
  checkbox:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, backgroundColor: colors.surface },
  amountPrefix:  { fontSize: 24, fontWeight: '700', color: colors.muted, marginRight: 4 },
  amountInput:   { flex: 1, fontSize: 32, fontWeight: '700', color: colors.ink, paddingVertical: 14 },
  amountHint:    { fontSize: 13, color: colors.muted },

  // Success
  successWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle:    { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  successSub:      { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  giftSummary:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: colors.border, gap: 2 },
});
