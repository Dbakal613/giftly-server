import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';
import { createNotification, markAllRead, notificationLabel } from '../lib/notificationHelpers';
import { getCurrentUser } from '../services/auth';
import { fetchProfile } from '../services/profiles';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [myId, setMyId]                   = useState(null);
  const [myProfile, setMyProfile]         = useState(null);
  const [actioningId, setActioningId]     = useState(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const user = await getCurrentUser();
    setMyId(user.id);
    const { data: profile } = await fetchProfile(user.id, 'name, username');
    setMyProfile(profile);
    await loadNotifications(user.id);
    await markAllRead(user.id);
  }

  async function loadNotifications(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) { console.error('loadNotifications error:', error.message); setLoading(false); return; }

    const rows = data || [];
    if (!rows.length) { setNotifications([]); setLoading(false); return; }

    const senderIds = [...new Set(rows.map(n => n.from_user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username')
      .in('id', senderIds);

    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    setNotifications(rows.map(n => ({ ...n, profiles: byId[n.from_user_id] || null })));
    setLoading(false);
  }

  const myName = myProfile?.name || myProfile?.username || 'Alguien';

  async function acceptRequest(notif) {
    setActioningId(notif.id);
    try {
      const senderId = notif.from_user_id;
      await supabase.from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', senderId).eq('friend_id', myId);
      await supabase.from('friendships').upsert(
        { user_id: myId, friend_id: senderId, status: 'accepted' },
        { onConflict: 'user_id,friend_id' }
      );
      createNotification({ userId: senderId, fromUserId: myId, type: 'friend_accepted', data: { name: myName } }).catch(() => {});
      await supabase.from('notifications').delete().eq('id', notif.id);
      await loadNotifications(myId);
    } catch (e) { console.error('acceptRequest:', e); }
    finally { setActioningId(null); }
  }

  async function declineRequest(notif) {
    setActioningId(notif.id);
    try {
      await supabase.from('friendships').delete().eq('user_id', notif.from_user_id).eq('friend_id', myId);
      createNotification({ userId: notif.from_user_id, fromUserId: myId, type: 'friend_declined', data: { name: myName } }).catch(() => {});
      await supabase.from('notifications').delete().eq('id', notif.id);
      await loadNotifications(myId);
    } catch (e) { console.error('declineRequest:', e); }
    finally { setActioningId(null); }
  }

  async function acceptGiftInvite(notif) {
    setActioningId(notif.id);
    try {
      const giftId = notif.data?.gift_id;
      if (!giftId) return;
      await supabase.from('group_gift_members').upsert(
        { group_gift_id: giftId, user_id: myId, amount: 0, status: 'accepted' },
        { onConflict: 'group_gift_id,user_id' }
      );
      createNotification({
        userId: notif.from_user_id, fromUserId: myId, type: 'gift_invite_accepted',
        data: { name: myName, recipient_name: notif.data?.recipient_name, gift_id: giftId },
      }).catch(() => {});
      await supabase.from('notifications').delete().eq('id', notif.id);
      await loadNotifications(myId);
      navigation.navigate('GroupGift', { giftId });
    } catch (e) { console.error('acceptGiftInvite:', e); }
    finally { setActioningId(null); }
  }

  async function declineGiftInvite(notif) {
    setActioningId(notif.id);
    try {
      await supabase.from('group_gift_members')
        .update({ status: 'declined' })
        .eq('group_gift_id', notif.data?.gift_id)
        .eq('user_id', myId);
      createNotification({
        userId: notif.from_user_id, fromUserId: myId, type: 'gift_invite_declined',
        data: { name: myName, recipient_name: notif.data?.recipient_name },
      }).catch(() => {});
      await supabase.from('notifications').delete().eq('id', notif.id);
      await loadNotifications(myId);
    } catch (e) { console.error('declineGiftInvite:', e); }
    finally { setActioningId(null); }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)} días`;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notificaciones" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Sin notificaciones"
          text="Aquí verás solicitudes de amistad e invitaciones a regalos"
          flex
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const enriched = {
              ...item,
              data: { ...item.data, name: item.profiles?.name || item.profiles?.username || item.data?.name },
            };
            const { text } = notificationLabel(enriched);
            const isRequest    = item.type === 'friend_request';
            const isGiftInvite = item.type === 'gift_invite';
            const actioning    = actioningId === item.id;

            return (
              <View style={[styles.notifItem, !item.is_read && styles.notifUnread]}>
                <View style={[styles.notifIcon, isGiftInvite && styles.notifIconGift]}>
                  <Feather
                    name={isGiftInvite ? 'gift' : isRequest ? 'user-plus' : 'bell'}
                    size={18}
                    color={isGiftInvite ? colors.green : colors.accent}
                  />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}>{text}</Text>
                  {isGiftInvite && item.data?.product_name && (
                    <Text style={styles.notifMeta}>{item.data.product_name}</Text>
                  )}
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>

                  {isRequest && (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(item)} disabled={actioning}>
                        {actioning
                          ? <ActivityIndicator size="small" color="white" />
                          : <Text style={styles.acceptBtnText}>Aceptar</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(item)} disabled={actioning}>
                        <Text style={styles.declineBtnText}>Rechazar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isGiftInvite && (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptGiftInvite(item)} disabled={actioning}>
                        {actioning
                          ? <ActivityIndicator size="small" color="white" />
                          : <Text style={styles.acceptBtnText}>Unirme</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => declineGiftInvite(item)} disabled={actioning}>
                        <Text style={styles.declineBtnText}>Rechazar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:           { padding: 16, gap: 8 },

  notifItem:      { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  notifUnread:    { backgroundColor: '#F5EBE8', borderColor: colors.accentLight },
  notifIcon:      { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.redBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifIconGift:  { backgroundColor: colors.greenBg },
  notifContent:   { flex: 1 },
  notifText:      { fontSize: 14, fontWeight: '500', color: colors.ink, lineHeight: 20, marginBottom: 2 },
  notifMeta:      { fontSize: 12, color: colors.muted, marginBottom: 4 },
  notifTime:      { fontSize: 12, color: colors.muted, marginBottom: 10 },

  actions:        { flexDirection: 'row', gap: 8 },
  acceptBtn:      { backgroundColor: colors.green, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  acceptBtnText:  { color: 'white', fontWeight: '600', fontSize: 13 },
  declineBtn:     { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  declineBtnText: { color: colors.muted, fontWeight: '500', fontSize: 13 },
});
