import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../lib/theme';
import { getCurrentUser } from '../services/auth';
import { fetchProfile } from '../services/profiles';
import {
  fetchFriends, fetchPendingRequests,
  searchUsers, checkFriendshipExists,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest,
} from '../services/friendships';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

export default function FriendsScreen({ navigation }) {
  const { toast, showToast } = useToast();
  const [friends, setFriends]       = useState([]);
  const [pending, setPending]       = useState([]);
  const [results, setResults]       = useState([]);
  const [query, setQuery]           = useState('');
  const [loading, setLoading]       = useState(true);
  const [actionId, setActionId]     = useState(null);
  const [myId, setMyId]             = useState(null);
  const [myProfile, setMyProfile]   = useState(null);

  useEffect(() => { init(); }, []);

  useFocusEffect(
    useCallback(() => {
      if (myId) { loadFriends(myId); loadPending(myId); }
    }, [myId])
  );

  async function init() {
    const user = await getCurrentUser();
    setMyId(user.id);
    const { data: prof } = await fetchProfile(user.id, 'name, username');
    setMyProfile(prof);
    await Promise.all([loadFriends(user.id), loadPending(user.id)]);
    setLoading(false);
  }

  async function loadFriends(id) {
    setFriends(await fetchFriends(id));
  }

  async function loadPending(id) {
    setPending(await fetchPendingRequests(id));
  }

  async function handleSearch(text) {
    setQuery(text);
    if (!text.trim()) { setResults([]); return; }
    setResults(await searchUsers({ query: text, excludeId: myId }));
  }

  async function handleSendRequest(friendId) {
    setActionId(friendId);
    try {
      const existing = await checkFriendshipExists(myId, friendId);
      if (existing) {
        showToast(existing.status === 'accepted' ? 'Ya son amigos' : 'Solicitud ya enviada');
        return;
      }
      await sendFriendRequest({ fromUserId: myId, toUserId: friendId, fromName: myProfile?.name || myProfile?.username || 'Alguien' });
      showToast('Solicitud enviada');
      setQuery('');
      setResults([]);
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleAccept(senderId) {
    setActionId(senderId);
    try {
      await acceptFriendRequest({ myId, senderId, myName: myProfile?.name || myProfile?.username || 'Alguien' });
      showToast('Ahora son amigos');
      await Promise.all([loadFriends(myId), loadPending(myId)]);
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(senderId) {
    await declineFriendRequest({ myId, senderId, myName: myProfile?.name || myProfile?.username || 'Alguien' });
    loadPending(myId);
  }

  const isSearching = query.trim().length > 0;
  const listData    = isSearching ? results : friends;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Amigos" onBack={() => navigation.goBack()} />
      <Toast message={toast} />

      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <Feather name="search" size={15} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o @usuario"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Feather name="x" size={16} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.friend_id || item.id || item.user_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={() => (
            <>
              {!isSearching && pending.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
                  {pending.map(p => (
                    <PendingRow
                      key={p.user_id}
                      profile={p.profiles}
                      loading={actionId === p.user_id}
                      onAccept={() => handleAccept(p.user_id)}
                      onDecline={() => handleDecline(p.user_id)}
                    />
                  ))}
                </View>
              )}
              <Text style={styles.sectionTitle}>
                {isSearching
                  ? `${results.length} resultado${results.length !== 1 ? 's' : ''}`
                  : `Mis amigos · ${friends.length}`}
              </Text>
            </>
          )}
          ListEmptyComponent={() => (
            <EmptyState
              icon="users"
              title={isSearching ? 'Sin resultados' : 'Aún no tienes amigos'}
              text={isSearching ? 'Prueba con otro nombre' : 'Busca personas por nombre o usuario'}
            />
          )}
          renderItem={({ item }) => {
            const profile = item.profiles || item;
            const isFriend = !isSearching;
            return (
              <FriendRow
                profile={profile}
                isFriend={isFriend}
                loading={actionId === profile.id}
                onView={() => navigation.navigate('FriendProfile', { profile })}
                onAdd={() => handleSendRequest(profile.id)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function Avatar({ name }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function PendingRow({ profile, loading, onAccept, onDecline }) {
  return (
    <View style={styles.row}>
      <Avatar name={profile?.name || profile?.username} />
      <View style={styles.info}>
        <Text style={styles.name}>{profile?.name || 'Sin nombre'}</Text>
        <Text style={styles.username}>@{profile?.username || 'usuario'}</Text>
      </View>
      <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} disabled={loading}>
        {loading
          ? <ActivityIndicator size="small" color="white" />
          : <Text style={styles.acceptBtnText}>Aceptar</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
        <Feather name="x" size={14} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

function FriendRow({ profile, isFriend, loading, onView, onAdd }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => isFriend && onView()}
      activeOpacity={isFriend ? 0.7 : 1}
    >
      <Avatar name={profile.name || profile.username} />
      <View style={styles.info}>
        <Text style={styles.name}>{profile.name || 'Sin nombre'}</Text>
        <Text style={styles.username}>@{profile.username || 'usuario'}</Text>
      </View>
      {isFriend ? (
        <TouchableOpacity style={styles.viewBtn} onPress={onView}>
          <Text style={styles.viewBtnText}>Ver perfil</Text>
          <Feather name="chevron-right" size={13} color={colors.ink} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.addBtn, loading && { opacity: 0.7 }]} onPress={onAdd} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color="white" />
            : <Text style={styles.addBtnText}>+ Agregar</Text>
          }
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchWrap:  { padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.tagBg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },

  list:        { padding: 16, gap: 10 },
  section:     { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: 'white', fontWeight: '700', fontSize: 17 },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '600', color: colors.ink },
  username:    { fontSize: 13, color: colors.muted },

  viewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  addBtn:      { backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, minWidth: 80, alignItems: 'center' },
  addBtnText:  { fontSize: 13, fontWeight: '600', color: 'white' },
  acceptBtn:   { backgroundColor: colors.green, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center' },
  acceptBtnText: { fontSize: 13, fontWeight: '600', color: 'white' },
  declineBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
});
