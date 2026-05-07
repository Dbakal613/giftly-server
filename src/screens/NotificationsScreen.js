import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import { createNotification, markAllRead, notificationLabel } from '../lib/notificationHelpers';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [myId, setMyId]                   = useState(null);
  const [myProfile, setMyProfile]         = useState(null);
  const [actioningId, setActioningId]     = useState(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    setMyId(user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', user.id)
      .maybeSingle();
    setMyProfile(profile);
    await fetchNotifications(user.id);
    await markAllRead(user.id);
  }

  async function fetchNotifications(userId) {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_from_user_id_fkey(name, username)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  }

  async function acceptRequest(notif) {
    setActioningId(notif.id);
    try {
      const senderId = notif.from_user_id;

      // Accept the friendship
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', senderId)
        .eq('friend_id', myId);

      // Create reverse
      await supabase.from('friendships').upsert({
        user_id: myId,
        friend_id: senderId,
        status: 'accepted',
      }, { onConflict: 'user_id,friend_id' });

      createNotification({
        userId: senderId,
        fromUserId: myId,
        type: 'friend_accepted',
        data: { name: myProfile?.name || myProfile?.username || 'Alguien' },
      }).catch(() => {});

      await supabase.from('notifications').delete().eq('id', notif.id);
      await fetchNotifications(myId);
    } catch (e) {
      console.error('acceptRequest error:', e);
    } finally {
      setActioningId(null);
    }
  }

  async function declineRequest(notif) {
    setActioningId(notif.id);
    try {
      const senderId = notif.from_user_id;

      // Delete the pending friendship
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', senderId)
        .eq('friend_id', myId);

      createNotification({
        userId: senderId,
        fromUserId: myId,
        type: 'friend_declined',
        data: { name: myProfile?.name || myProfile?.username || 'Alguien' },
      }).catch(() => {});

      await supabase.from('notifications').delete().eq('id', notif.id);
      await fetchNotifications(myId);
    } catch (e) {
      console.error('declineRequest error:', e);
    } finally {
      setActioningId(null);
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D94F3D" /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Sin notificaciones</Text>
              <Text style={styles.emptyText}>Te avisaremos cuando alguien quiera ser tu amigo</Text>
            </View>
          )}
          renderItem={({ item }) => {
            // Merge profile data into notif.data
            const enriched = {
              ...item,
              data: {
                ...item.data,
                name: item.profiles?.name || item.profiles?.username || item.data?.name,
              },
            };
            const { icon, text } = notificationLabel(enriched);
            const isRequest = item.type === 'friend_request';
            const actioning = actioningId === item.id;

            return (
              <View style={[styles.notifItem, !item.is_read && styles.notifUnread]}>
                <View style={styles.notifIcon}>
                  <Text style={styles.notifIconText}>{icon}</Text>
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}>{text}</Text>
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                  {isRequest && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => acceptRequest(item)}
                        disabled={actioning}
                      >
                        {actioning
                          ? <ActivityIndicator size="small" color="white" />
                          : <Text style={styles.acceptBtnText}>✓ Aceptar</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => declineRequest(item)}
                        disabled={actioning}
                      >
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
  container:      { flex: 1, backgroundColor: '#FAFAF7' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn:        { padding: 4 },
  backText:       { fontSize: 22, color: '#1A1A18' },
  headerTitle:    { fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  list:           { padding: 16, gap: 8 },
  empty:          { alignItems: 'center', paddingTop: 80 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#1A1A18', marginBottom: 6 },
  emptyText:      { fontSize: 14, color: '#8A8A82', textAlign: 'center' },
  notifItem:      { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8E8E2' },
  notifUnread:    { backgroundColor: '#FFF8F7', borderColor: '#FBD0CB' },
  notifIcon:      { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FDE8E5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifIconText:  { fontSize: 20 },
  notifContent:   { flex: 1 },
  notifText:      { fontSize: 14, fontWeight: '500', color: '#1A1A18', lineHeight: 20, marginBottom: 4 },
  notifTime:      { fontSize: 12, color: '#8A8A82', marginBottom: 10 },
  actions:        { flexDirection: 'row', gap: 8 },
  acceptBtn:      { backgroundColor: '#2D8C5E', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  acceptBtnText:  { color: 'white', fontWeight: '600', fontSize: 13 },
  declineBtn:     { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 },
  declineBtnText: { color: '#8A8A82', fontWeight: '500', fontSize: 13 },
});
