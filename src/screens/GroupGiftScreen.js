import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notificationHelpers';

const OCCASIONS = ['🎂 Cumpleaños', '🎄 Navidad', '💍 Aniversario', '🎓 Graduación', '🏠 Nuevo hogar', '🎉 Otro'];

const STATUS_LABEL = {
  paid:     { label: 'Pagado',    color: '#2D8C5E', bg: '#DCF5EB' },
  accepted: { label: 'Confirmado', color: '#3D7DD9', bg: '#E8F0FE' },
  pending:  { label: 'Pendiente', color: '#E8A020', bg: '#FFF8E6' },
  invited:  { label: 'Invitado',  color: '#8A8A82', bg: '#F0EFE8' },
  declined: { label: 'Declinó',   color: '#B0AFA8', bg: '#F0EFE8' },
};

export default function GroupGiftScreen({ route, navigation }) {
  const { giftId, product: initialProduct, openInviteOnLoad } = route.params || {};
  const isManagement = !!giftId;

  // ── Shared state ──────────────────────────────────────────────────────────────
  const [myId, setMyId]           = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  // ── Management state ──────────────────────────────────────────────────────────
  const [giftData, setGiftData]         = useState(null);
  const [loadingGift, setLoadingGift]   = useState(isManagement);
  const [toast, setToast]               = useState('');

  // Invite modal
  const [showInvite, setShowInvite]           = useState(false);
  const [friends, setFriends]                 = useState([]);
  const [loadingFriends, setLoadingFriends]   = useState(false);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [sendingInvites, setSendingInvites]   = useState(false);

  // Edit modal
  const [showEdit, setShowEdit]       = useState(false);
  const [editRecipient, setEditRecipient] = useState('');
  const [editOccasion, setEditOccasion]   = useState('');
  const [editMessage, setEditMessage]     = useState('');
  const [savingEdit, setSavingEdit]       = useState(false);

  // Amount modal
  const [showAmount, setShowAmount]       = useState(false);
  const [myContribution, setMyContribution] = useState('');
  const [savingAmount, setSavingAmount]   = useState(false);

  // ── Creation state ────────────────────────────────────────────────────────────
  const [step, setStep]                 = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [occasion, setOccasion]         = useState('');
  const [message, setMessage]           = useState('');
  const [myAmount, setMyAmount]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [created, setCreated]           = useState(false);
  const [createdGiftId, setCreatedGiftId] = useState(null);
  const [createError, setCreateError]   = useState('');

  useEffect(() => { init(); }, []);

  // Auto-open invite modal when navigating from creation success screen
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

  // ── Management: data fetching ─────────────────────────────────────────────────

  async function fetchGiftData() {
    setLoadingGift(true);

    // Fetch gift + product in one query
    const { data: giftRaw, error: giftErr } = await supabase
      .from('group_gifts')
      .select(`*, products(id, name, image_emoji, image_url, price, store, brand)`)
      .eq('id', giftId)
      .single();

    if (giftErr || !giftRaw) {
      console.error('fetchGiftData error:', giftErr?.message, '| code:', giftErr?.code);
      setGiftData(null);
      setLoadingGift(false);
      return;
    }

    // Fetch members separately to avoid FK constraint name issues
    const { data: membersRaw } = await supabase
      .from('group_gift_members')
      .select('id, amount, status, joined_at, user_id')
      .eq('group_gift_id', giftId);

    const members = membersRaw || [];

    // Fetch member profiles separately
    const memberIds = members.map(m => m.user_id);
    let profilesById = {};
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, username').in('id', memberIds);
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }

    const data = {
      ...giftRaw,
      group_gift_members: members.map(m => ({
        ...m, profiles: profilesById[m.user_id] || null,
      })),
    };

    setGiftData(data);
    setLoadingGift(false);
  }

  function showToastMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  // ── Management: invites ───────────────────────────────────────────────────────

  async function openInvite() {
    setShowInvite(true);
    setLoadingFriends(true);

    const { data } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', myId)
      .eq('status', 'accepted');

    const memberIds  = new Set((giftData?.group_gift_members || []).map(m => m.user_id));
    const friendIds  = (data || []).map(f => f.friend_id).filter(id => !memberIds.has(id));

    if (!friendIds.length) {
      setFriends([]);
      setSelectedFriends(new Set());
      setLoadingFriends(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles').select('id, name, username').in('id', friendIds);

    setFriends(profiles || []);
    setSelectedFriends(new Set());
    setLoadingFriends(false);
  }

  function toggleFriend(id) {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (selectedFriends.size === 0) return;
    setSendingInvites(true);
    try {
      for (const friendId of selectedFriends) {
        // Add as invited member
        await supabase.from('group_gift_members').upsert(
          { group_gift_id: giftId, user_id: friendId, amount: 0, status: 'invited' },
          { onConflict: 'group_gift_id,user_id' }
        );
        createNotification({
          userId: friendId, fromUserId: myId, type: 'gift_invite',
          data: {
            name:           myProfile?.name || myProfile?.username || 'Alguien',
            gift_id:        giftId,
            recipient_name: giftData?.recipient_name,
            occasion:       giftData?.occasion,
            product_name:   giftData?.products?.name,
          },
        }).catch(() => {});
      }
      setShowInvite(false);
      setSelectedFriends(new Set());
      const n = selectedFriends.size;
      showToastMsg(`✓ ${n} invitación${n !== 1 ? 'es' : ''} enviada${n !== 1 ? 's' : ''}`);
      fetchGiftData();
    } catch (e) { console.error('sendInvites error:', e); }
    finally { setSendingInvites(false); }
  }

  // ── Management: edit gift ─────────────────────────────────────────────────────

  function openEdit() {
    setEditRecipient(giftData?.recipient_name || '');
    setEditOccasion(
      OCCASIONS.find(o => o.replace(/^[^ ]+ /, '') === giftData?.occasion) || ''
    );
    setEditMessage(giftData?.message || '');
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editRecipient.trim()) return;
    setSavingEdit(true);
    try {
      await supabase.from('group_gifts').update({
        recipient_name: editRecipient.trim(),
        occasion:       editOccasion.replace(/^[^ ]+ /, ''),
        message:        editMessage.trim(),
      }).eq('id', giftId);
      setShowEdit(false);
      fetchGiftData();
    } catch (e) { console.error('saveEdit error:', e); }
    finally { setSavingEdit(false); }
  }

  // ── Management: update contribution ──────────────────────────────────────────

  async function saveAmount() {
    const amount = parseInt(myContribution.replace(/\D/g, ''), 10);
    if (!amount) return;
    setSavingAmount(true);
    try {
      const myMember = (giftData?.group_gift_members || []).find(m => m.user_id === myId);
      if (myMember) {
        await supabase.from('group_gift_members')
          .update({ amount, status: 'paid' }).eq('id', myMember.id);
      } else {
        await supabase.from('group_gift_members').insert({
          group_gift_id: giftId, user_id: myId, amount, status: 'paid',
        });
      }
      setShowAmount(false);
      setMyContribution('');
      fetchGiftData();
    } catch (e) { console.error('saveAmount error:', e); }
    finally { setSavingAmount(false); }
  }

  // ── Creation: save new gift ───────────────────────────────────────────────────

  async function createGift() {
    if (!recipientName) return;
    if (!occasion)      return;
    setLoading(true);
    setCreateError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let productId = initialProduct?.id;
      if (!productId && initialProduct) {
        const { data: newP, error: prodErr } = await supabase.from('products')
          .insert({
            name:        initialProduct.name,
            brand:       initialProduct.brand || '',
            store:       initialProduct.store || '',
            price:       Math.round(initialProduct.price || 0),
            image_emoji: initialProduct.image_emoji || '📦',
            image_url:   initialProduct.image_url || null,
            category:    initialProduct.category || '',
          }).select('id').single();
        if (prodErr) {
          console.error('product insert error:', prodErr.message);
        } else {
          productId = newP?.id;
        }
      }

      const { data: gift, error } = await supabase.from('group_gifts').insert({
        creator_id:     user.id,
        recipient_name: recipientName,
        product_id:     productId || null,
        occasion:       occasion.replace(/^[^ ]+ /, ''),
        message,
        status:         'active',
      }).select('id').single();

      if (error) throw error;
      setCreatedGiftId(gift.id);

      if (myAmount) {
        await supabase.from('group_gift_members').insert({
          group_gift_id: gift.id, user_id: user.id,
          amount: parseInt(myAmount.replace(/\D/g, ''), 10),
          status: 'paid',
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

  // ══════════════════════════════════════════════════════════════════════════════
  // MANAGEMENT VIEW
  // ══════════════════════════════════════════════════════════════════════════════

  if (isManagement) {
    if (loadingGift) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Regalo grupal 🎁</Text>
          </View>
          <View style={styles.center}><ActivityIndicator color="#D94F3D" size="large" /></View>
        </View>
      );
    }

    if (!giftData) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Regalo grupal 🎁</Text>
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>No se pudo cargar el regalo.</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8, color: '#D94F3D' }]}>
              Revisa la consola para ver el error exacto.
            </Text>
            <TouchableOpacity
              style={{ marginTop: 16, backgroundColor: '#D94F3D', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
              onPress={() => fetchGiftData()}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Reintentar</Text>
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
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Regalo grupal 🎁</Text>
          {isCreator && (
            <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✏️ Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Toast ── */}
        {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Gift summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryFor}>Para <Text style={styles.summaryName}>{giftData.recipient_name}</Text></Text>
            <Text style={styles.summaryOccasion}>{giftData.occasion}</Text>
            {giftData.message ? <Text style={styles.summaryMessage}>"{giftData.message}"</Text> : null}
          </View>

          {/* Product */}
          {giftData.products && (
            <View style={styles.productCard}>
              <Text style={styles.productEmoji}>{giftData.products.image_emoji || '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={2}>{giftData.products.name}</Text>
                <Text style={styles.productStore}>{giftData.products.store}</Text>
              </View>
              <Text style={styles.productPrice}>${Math.round(giftData.products.price || 0).toLocaleString('es-CL')}</Text>
            </View>
          )}

          {/* Progress */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>💰 Progreso</Text>
            <View style={styles.progressAmounts}>
              <Text style={styles.progressCollected}>${totalCollected.toLocaleString('es-CL')}</Text>
              {totalTarget > 0 && <Text style={styles.progressTarget}>de ${totalTarget.toLocaleString('es-CL')}</Text>}
            </View>
            {totalTarget > 0 && (
              <>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressPct}>{Math.round(progressPct)}% recaudado</Text>
              </>
            )}
          </View>

          {/* Members */}
          <View style={styles.membersCard}>
            <Text style={styles.membersTitle}>👥 Participantes · {activeMembers.length}</Text>
            {allMembers
              .filter(m => m.status !== 'declined')
              .map(member => {
                const statusInfo = STATUS_LABEL[member.status] || STATUS_LABEL.pending;
                const displayName = member.profiles?.name || member.profiles?.username || 'Usuario';
                const initial = displayName.charAt(0).toUpperCase();
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, member.user_id === giftData.creator_id && styles.memberAvatarCreator]}>
                      <Text style={styles.memberAvatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>{displayName}</Text>
                        {member.user_id === giftData.creator_id && (
                          <Text style={styles.creatorBadge}>👑</Text>
                        )}
                        {member.user_id === myId && (
                          <Text style={styles.youBadge}>Tú</Text>
                        )}
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
              <Text style={styles.noMembers}>Aún no hay participantes. ¡Invita a tus amigos!</Text>
            )}
          </View>

          {/* Update my contribution */}
          {needsAmount && (
            <TouchableOpacity style={styles.amountPrompt} onPress={() => setShowAmount(true)}>
              <Text style={styles.amountPromptText}>💵 Definir mi aporte →</Text>
            </TouchableOpacity>
          )}

          {/* Invite button */}
          <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
            <Text style={styles.inviteBtnText}>+ Invitar amigos</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── Invite modal ── */}
        <Modal visible={showInvite} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Invitar amigos</Text>
              <Text style={styles.modalSub}>Solo amigos que aún no están en el regalo</Text>
              {loadingFriends ? (
                <View style={styles.center}><ActivityIndicator color="#D94F3D" /></View>
              ) : friends.length === 0 ? (
                <Text style={styles.noFriendsText}>No hay amigos disponibles para invitar</Text>
              ) : (
                <FlatList
                  data={friends}
                  keyExtractor={f => f.id}
                  style={{ maxHeight: 280 }}
                  renderItem={({ item }) => {
                    const selected = selectedFriends.has(item.id);
                    return (
                      <TouchableOpacity style={styles.friendRow} onPress={() => toggleFriend(item.id)}>
                        <View style={styles.friendAvatar}>
                          <Text style={styles.friendAvatarText}>
                            {(item.name || item.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{item.name || 'Sin nombre'}</Text>
                          <Text style={styles.friendUser}>@{item.username}</Text>
                        </View>
                        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                          {selected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              <TouchableOpacity
                style={[styles.btnPrimary, (selectedFriends.size === 0 || sendingInvites) && { opacity: 0.5 }]}
                onPress={sendInvites}
                disabled={selectedFriends.size === 0 || sendingInvites}
              >
                {sendingInvites
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.btnPrimaryText}>
                      Invitar{selectedFriends.size > 0 ? ` (${selectedFriends.size})` : ''}
                    </Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Edit modal ── */}
        <Modal visible={showEdit} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>✏️ Editar regalo</Text>
              <Text style={styles.fieldLabel}>¿Para quién?</Text>
              <TextInput
                style={styles.input}
                value={editRecipient}
                onChangeText={setEditRecipient}
                placeholder="Nombre de quien recibe"
              />
              <Text style={styles.fieldLabel}>Ocasión</Text>
              <View style={styles.occasionGrid}>
                {OCCASIONS.map(o => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.occasionBtn, editOccasion === o && styles.occasionBtnActive]}
                    onPress={() => setEditOccasion(o)}
                  >
                    <Text style={[styles.occasionText, editOccasion === o && styles.occasionTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Mensaje (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={editMessage}
                onChangeText={setEditMessage}
                placeholder="Un mensaje especial..."
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.btnPrimary, (!editRecipient.trim() || savingEdit) && { opacity: 0.5 }]}
                onPress={saveEdit}
                disabled={!editRecipient.trim() || savingEdit}
              >
                {savingEdit ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Amount modal ── */}
        <Modal visible={showAmount} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAmount(false)} />
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>💵 Mi aporte</Text>
              <Text style={styles.modalSub}>¿Cuánto quieres aportar a este regalo?</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={myContribution}
                  onChangeText={setMyContribution}
                  keyboardType="numeric"
                  placeholder="0"
                  autoFocus
                />
              </View>
              {giftData.products && (
                <Text style={styles.amountHint}>
                  Sugerido (1/3): ${Math.round((giftData.products.price || 0) / 3).toLocaleString('es-CL')}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btnPrimary, (!myContribution || savingAmount) && { opacity: 0.5 }]}
                onPress={saveAmount}
                disabled={!myContribution || savingAmount}
              >
                {savingAmount ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Confirmar aporte</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAmount(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CREATION FLOW
  // ══════════════════════════════════════════════════════════════════════════════

  // Success screen
  if (step === 3 && created) {
    return (
      <View style={styles.container}>
        <View style={styles.successWrap}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>¡Regalo grupal creado!</Text>
          <Text style={styles.successSub}>Invita a tus amigos desde la pantalla del regalo para que se unan y aporten.</Text>
          <View style={styles.giftSummary}>
            <Text style={styles.summaryLabel}>Para</Text>
            <Text style={styles.summaryValue}>{recipientName}</Text>
            <Text style={styles.summaryLabel}>Ocasión</Text>
            <Text style={styles.summaryValue}>{occasion}</Text>
            {initialProduct && (
              <>
                <Text style={styles.summaryLabel}>Producto</Text>
                <Text style={styles.summaryValue}>{initialProduct.name}</Text>
                <Text style={styles.summaryLabel}>Precio</Text>
                <Text style={styles.summaryValue}>${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}</Text>
              </>
            )}
            {myAmount && (
              <>
                <Text style={styles.summaryLabel}>Tu aporte</Text>
                <Text style={[styles.summaryValue, { color: '#2D8C5E', fontWeight: '700' }]}>
                  ${parseInt(myAmount.replace(/\D/g, ''), 10).toLocaleString('es-CL')}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('GroupGift', { giftId: createdGiftId, openInviteOnLoad: true })}
          >
            <Text style={styles.btnPrimaryText}>Invitar amigos 👥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 14, padding: 16 }]}
            onPress={() => navigation.navigate('GroupGift', { giftId: createdGiftId })}
          >
            <Text style={[styles.cancelBtnText, { color: '#1A1A18', fontWeight: '600' }]}>Ver el regalo 🎁</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.cancelBtnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step === 1 ? navigation.goBack() : setStep(step - 1)}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo regalo grupal 🎁</Text>
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
            {initialProduct && (
              <View style={styles.productCard}>
                <Text style={styles.productEmoji}>{initialProduct.image_emoji || '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{initialProduct.name}</Text>
                  <Text style={styles.productPrice}>${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}</Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>¿Para quién es el regalo?</Text>
              <TextInput
                style={styles.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Nombre de la persona"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Ocasión</Text>
              <View style={styles.occasionGrid}>
                {OCCASIONS.map(o => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.occasionBtn, occasion === o && styles.occasionBtnActive]}
                    onPress={() => setOccasion(o)}
                  >
                    <Text style={[styles.occasionText, occasion === o && styles.occasionTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mensaje (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder="¡Feliz cumpleaños! Con cariño..."
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, (!recipientName.trim() || !occasion) && { opacity: 0.5 }]}
              onPress={() => {
                if (!recipientName.trim() || !occasion) return;
                setStep(2);
              }}
            >
              <Text style={styles.btnPrimaryText}>Continuar →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.createSummaryCard}>
              <Text style={styles.createSummaryTitle}>Resumen del regalo</Text>
              <Text style={styles.createSummaryItem}>👤 Para: <Text style={{ fontWeight: '700' }}>{recipientName}</Text></Text>
              <Text style={styles.createSummaryItem}>🎉 Ocasión: <Text style={{ fontWeight: '700' }}>{occasion}</Text></Text>
              {initialProduct && (
                <Text style={styles.createSummaryItem}>
                  🛍️ Precio total: <Text style={{ fontWeight: '700', color: '#D94F3D' }}>
                    ${Math.round(initialProduct.price || 0).toLocaleString('es-CL')}
                  </Text>
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>¿Cuánto quieres aportar tú?</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={myAmount}
                  onChangeText={setMyAmount}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              {initialProduct && (
                <Text style={styles.amountHint}>
                  Sugerido (1/3): ${Math.round((initialProduct.price || 0) / 3).toLocaleString('es-CL')}
                </Text>
              )}
            </View>

            {createError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
              onPress={createGift}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Crear regalo grupal 🎁</Text>}
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

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#FAFAF7' },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:          { fontSize: 14, color: '#8A8A82', textAlign: 'center' },

  header:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn:            { padding: 4 },
  backText:           { fontSize: 22, color: '#1A1A18' },
  headerTitle:        { flex: 1, fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  editBtn:            { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5, borderColor: '#E8E8E2' },
  editBtnText:        { fontSize: 13, color: '#1A1A18', fontWeight: '500' },

  toast:              { backgroundColor: '#1A1A18', margin: 16, borderRadius: 12, padding: 13, alignItems: 'center' },
  toastText:          { color: 'white', fontWeight: '600', fontSize: 14 },

  scroll:             { padding: 20, gap: 14, paddingBottom: 40 },

  // Management cards
  summaryCard:        { backgroundColor: '#1A1A18', borderRadius: 16, padding: 20 },
  summaryFor:         { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  summaryName:        { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  summaryOccasion:    { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  summaryMessage:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginTop: 8 },

  productCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8E8E2' },
  productEmoji:       { fontSize: 36 },
  productName:        { fontSize: 14, fontWeight: '600', color: '#1A1A18', marginBottom: 4 },
  productStore:       { fontSize: 12, color: '#8A8A82' },
  productPrice:       { fontSize: 18, fontWeight: '700', color: '#D94F3D' },

  progressCard:       { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E8E8E2', gap: 8 },
  progressTitle:      { fontSize: 13, fontWeight: '700', color: '#1A1A18', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressAmounts:    { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  progressCollected:  { fontSize: 28, fontWeight: '800', color: '#2D8C5E' },
  progressTarget:     { fontSize: 14, color: '#8A8A82' },
  progressBar:        { height: 8, backgroundColor: '#F0EFE8', borderRadius: 100, overflow: 'hidden' },
  progressFill:       { height: '100%', backgroundColor: '#2D8C5E', borderRadius: 100 },
  progressPct:        { fontSize: 13, color: '#8A8A82' },

  membersCard:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E8E8E2', gap: 2 },
  membersTitle:       { fontSize: 13, fontWeight: '700', color: '#1A1A18', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  noMembers:          { fontSize: 13, color: '#8A8A82', textAlign: 'center', paddingVertical: 12 },
  memberRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F8F8F5' },
  memberAvatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center' },
  memberAvatarCreator:{ backgroundColor: '#1A1A18' },
  memberAvatarText:   { color: 'white', fontWeight: '700', fontSize: 15 },
  memberNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberName:         { fontSize: 14, fontWeight: '600', color: '#1A1A18' },
  creatorBadge:       { fontSize: 12 },
  youBadge:           { fontSize: 10, color: '#D94F3D', fontWeight: '700', backgroundColor: '#FDE8E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  memberAmount:       { fontSize: 13, color: '#8A8A82', marginTop: 1 },
  statusBadge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  statusText:         { fontSize: 11, fontWeight: '600' },

  amountPrompt:       { backgroundColor: '#FFF8E6', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#F5C842' },
  amountPromptText:   { fontSize: 14, fontWeight: '600', color: '#E8A020' },
  inviteBtn:          { backgroundColor: '#1A1A18', borderRadius: 14, padding: 16, alignItems: 'center' },
  inviteBtnText:      { color: 'white', fontSize: 15, fontWeight: '700' },

  // Modals
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, margin: 16, gap: 12 },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: '#1A1A18' },
  modalSub:           { fontSize: 13, color: '#8A8A82', marginTop: -8 },
  noFriendsText:      { fontSize: 14, color: '#8A8A82', textAlign: 'center', paddingVertical: 24 },
  friendRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EFE8' },
  friendAvatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center' },
  friendAvatarText:   { color: 'white', fontWeight: '700', fontSize: 15 },
  friendName:         { fontSize: 14, fontWeight: '600', color: '#1A1A18' },
  friendUser:         { fontSize: 12, color: '#8A8A82' },
  checkbox:           { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D0CFC8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:    { backgroundColor: '#D94F3D', borderColor: '#D94F3D' },
  checkmark:          { color: 'white', fontSize: 12, fontWeight: '800' },
  amountInputWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E8E8E2', borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  amountPrefix:       { fontSize: 24, fontWeight: '700', color: '#8A8A82', marginRight: 4 },
  amountInput:        { flex: 1, fontSize: 32, fontWeight: '700', color: '#1A1A18', paddingVertical: 14 },
  amountHint:         { fontSize: 13, color: '#8A8A82' },

  // Creation
  steps:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#FFFFFF' },
  stepWrap:           { flexDirection: 'row', alignItems: 'center' },
  stepDot:            { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center' },
  stepDotActive:      { backgroundColor: '#D94F3D' },
  stepNum:            { fontSize: 14, fontWeight: '700', color: '#8A8A82' },
  stepNumActive:      { color: 'white' },
  stepLabel:          { fontSize: 12, color: '#8A8A82', marginLeft: 6 },
  stepLabelActive:    { color: '#D94F3D', fontWeight: '600' },
  stepLine:           { width: 40, height: 2, backgroundColor: '#E8E8E2', marginHorizontal: 8 },
  stepLineActive:     { backgroundColor: '#D94F3D' },

  field:              { gap: 8 },
  fieldLabel:         { fontSize: 12, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1 },
  input:              { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A18', backgroundColor: '#FFFFFF' },
  textarea:           { minHeight: 80, textAlignVertical: 'top' },
  occasionGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: '#E8E8E2', backgroundColor: '#FFFFFF' },
  occasionBtnActive:  { borderColor: '#D94F3D', backgroundColor: '#FDE8E5' },
  occasionText:       { fontSize: 13, color: '#8A8A82' },
  occasionTextActive: { color: '#D94F3D', fontWeight: '600' },
  createSummaryCard:  { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E8E8E2', gap: 8 },
  createSummaryTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A18', marginBottom: 4 },
  createSummaryItem:  { fontSize: 14, color: '#8A8A82' },

  errorBox:           { backgroundColor: '#FDE8E5', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F5C0BB' },
  errorText:          { color: '#D94F3D', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  btnPrimary:         { backgroundColor: '#D94F3D', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText:     { color: 'white', fontSize: 16, fontWeight: '700' },
  cancelBtn:          { padding: 14, alignItems: 'center' },
  cancelBtnText:      { fontSize: 14, color: '#8A8A82' },

  // Success
  successWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji:       { fontSize: 72, marginBottom: 20 },
  successTitle:       { fontSize: 26, fontWeight: '700', color: '#1A1A18', marginBottom: 10, textAlign: 'center' },
  successSub:         { fontSize: 15, color: '#8A8A82', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  giftSummary:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: '#E8E8E2', gap: 6 },
  summaryLabel:       { fontSize: 11, color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  summaryValue:       { fontSize: 15, fontWeight: '600', color: '#1A1A18' },
});
