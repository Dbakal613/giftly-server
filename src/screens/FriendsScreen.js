import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notificationHelpers';

export default function FriendsScreen({ navigation }) {
  const [friends, setFriends]           = useState([]);
  const [pending, setPending]           = useState([]);   // incoming requests
  const [search, setSearch]             = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [addingId, setAddingId]         = useState(null);
  const [toast, setToast]               = useState('');
  const [myId, setMyId]                 = useState(null);
  const [myProfile, setMyProfile]       = useState(null);

  useEffect(() => { init(); }, []);

  // Re-fetch when returning from NotificationsScreen (after accepting a request)
  useFocusEffect(
    useCallback(() => {
      if (myId) {
        fetchFriends(myId);
        fetchPending(myId);
      }
    }, [myId])
  );

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    setMyId(user.id);
    const { data: profile } = await supabase
      .from('profiles').select('name, username').eq('id', user.id).maybeSingle();
    setMyProfile(profile);
    await Promise.all([fetchFriends(user.id), fetchPending(user.id)]);
    setLoading(false);
  }

  async function fetchFriends(userId) {
    const { data } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const rows = data || [];
    if (!rows.length) { setFriends([]); return; }

    const ids = rows.map(r => r.friend_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, name, username').in('id', ids);
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    setFriends(rows.map(r => ({ friend_id: r.friend_id, profiles: byId[r.friend_id] || null })));
  }

  async function fetchPending(userId) {
    const { data } = await supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_id', userId)
      .eq('status', 'pending');

    const rows = data || [];
    if (!rows.length) { setPending([]); return; }

    const ids = rows.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, name, username').in('id', ids);
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    setPending(rows.map(r => ({ user_id: r.user_id, profiles: byId[r.user_id] || null })));
  }

  async function searchUsers(text) {
    setSearch(text);
    if (!text.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, name, username')
      .or(`username.ilike.%${text}%,name.ilike.%${text}%`)
      .neq('id', myId)
      .limit(10);
    setSearchResults(data || []);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function sendRequest(friendId) {
    setAddingId(friendId);
    try {
      // Check if already sent
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('user_id', myId)
        .eq('friend_id', friendId)
        .maybeSingle();

      if (existing) {
        showToast(existing.status === 'accepted' ? 'Ya son amigos' : 'Solicitud ya enviada');
        return;
      }

      const { error } = await supabase.from('friendships').insert({
        user_id: myId,
        friend_id: friendId,
        status: 'pending',
      });
      if (error) throw error;

      // Notify — never block the main flow if this fails
      createNotification({
        userId: friendId,
        fromUserId: myId,
        type: 'friend_request',
        data: { name: myProfile?.name || myProfile?.username || 'Alguien' },
      }).catch(e => console.warn('notify error:', e.message));

      showToast('✓ Solicitud enviada');
      setSearch('');
      setSearchResults([]);
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setAddingId(null);
    }
  }

  async function acceptRequest(senderId) {
    setAddingId(senderId);
    try {
      // Accept the incoming request
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', senderId)
        .eq('friend_id', myId);

      // Create reverse friendship so both can see each other
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
      }).catch(e => console.warn('notify error:', e.message));

      showToast('✓ Ahora son amigos');
      await Promise.all([fetchFriends(myId), fetchPending(myId)]);
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setAddingId(null);
    }
  }

  async function ignoreRequest(senderId) {
    await supabase.from('friendships').delete()
      .eq('user_id', senderId).eq('friend_id', myId);
    createNotification({
      userId: senderId,
      fromUserId: myId,
      type: 'friend_declined',
      data: { name: myProfile?.name || myProfile?.username || 'Alguien' },
    }).catch(e => console.warn('notify error:', e.message));
    fetchPending(myId);
  }

  function goToFriendProfile(profile) {
    navigation.navigate('FriendProfile', { profile });
  }

  const isSearching = search.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Amigos</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar por nombre o @usuario"
          value={search}
          onChangeText={searchUsers}
          autoCapitalize="none"
        />
      </View>

      {/* Toast */}
      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D94F3D" /></View>
      ) : (
        <FlatList
          data={isSearching ? searchResults : friends}
          keyExtractor={item => item.friend_id || item.id || item.user_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={() => (
            <>
              {/* Pending requests (only when not searching) */}
              {!isSearching && pending.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
                  {pending.map(p => {
                    const profile = p.profiles;
                    return (
                      <View key={p.user_id} style={styles.row}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {(profile?.name || profile?.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.info}>
                          <Text style={styles.name}>{profile?.name || 'Sin nombre'}</Text>
                          <Text style={styles.username}>@{profile?.username || 'usuario'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => acceptRequest(p.user_id)}
                          disabled={addingId === p.user_id}
                        >
                          {addingId === p.user_id
                            ? <ActivityIndicator size="small" color="white" />
                            : <Text style={styles.acceptBtnText}>Aceptar</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ignoreBtn}
                          onPress={() => ignoreRequest(p.user_id)}
                        >
                          <Text style={styles.ignoreBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Section label */}
              <Text style={styles.sectionTitle}>
                {isSearching ? `${searchResults.length} resultados` : `Mis amigos · ${friends.length}`}
              </Text>
            </>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>
                {isSearching ? 'Sin resultados' : 'Aún no tienes amigos'}
              </Text>
              <Text style={styles.emptyText}>
                {isSearching ? 'Prueba con otro nombre' : 'Busca personas por nombre o usuario'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const profile = item.profiles || item;
            const isFriend = !isSearching;

            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => isFriend && goToFriendProfile(profile)}
                activeOpacity={isFriend ? 0.7 : 1}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(profile.name || profile.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{profile.name || 'Sin nombre'}</Text>
                  <Text style={styles.username}>@{profile.username || 'usuario'}</Text>
                </View>
                {isFriend ? (
                  <TouchableOpacity style={styles.viewBtn} onPress={() => goToFriendProfile(profile)}>
                    <Text style={styles.viewBtnText}>Ver perfil →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.addBtn, addingId === profile.id && styles.addBtnLoading]}
                    onPress={() => sendRequest(profile.id)}
                    disabled={addingId === profile.id}
                  >
                    {addingId === profile.id
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={styles.addBtnText}>+ Agregar</Text>
                    }
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
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
  searchWrap:     { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  searchInput:    { backgroundColor: '#FAFAF7', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#E8E8E2', fontSize: 15 },
  toast:          { backgroundColor: '#1A1A18', margin: 16, borderRadius: 12, padding: 12, alignItems: 'center' },
  toastText:      { color: 'white', fontWeight: '600', fontSize: 14 },
  list:           { padding: 16, gap: 10 },
  section:        { marginBottom: 16 },
  sectionTitle:   { fontSize: 12, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8E8E2' },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D94F3D', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: 'white', fontWeight: '700', fontSize: 17 },
  info:           { flex: 1 },
  name:           { fontSize: 15, fontWeight: '600', color: '#1A1A18' },
  username:       { fontSize: 13, color: '#8A8A82' },
  viewBtn:        { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  viewBtnText:    { fontSize: 13, fontWeight: '600', color: '#1A1A18' },
  addBtn:         { backgroundColor: '#D94F3D', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7, minWidth: 80, alignItems: 'center' },
  addBtnLoading:  { opacity: 0.7 },
  addBtnText:     { fontSize: 13, fontWeight: '600', color: 'white' },
  acceptBtn:      { backgroundColor: '#2D8C5E', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center' },
  acceptBtnText:  { fontSize: 13, fontWeight: '600', color: 'white' },
  ignoreBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center' },
  ignoreBtnText:  { fontSize: 12, color: '#8A8A82' },
  empty:          { alignItems: 'center', paddingTop: 60 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#1A1A18', marginBottom: 6 },
  emptyText:      { fontSize: 14, color: '#8A8A82', textAlign: 'center' },
});
