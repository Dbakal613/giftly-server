import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notificationHelpers';

async function resolveProfiles(rows, idField) {
  if (!rows.length) return [];
  const ids = rows.map(r => r[idField]);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, username')
    .in('id', ids);
  const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return rows.map(r => ({ ...r, profiles: byId[r[idField]] || null }));
}

export async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  if (error || !data?.length) return [];
  return resolveProfiles(data, 'friend_id');
}

export async function fetchPendingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error || !data?.length) return [];
  return resolveProfiles(data, 'user_id');
}

export async function searchUsers({ query, excludeId }) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, username')
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
    .neq('id', excludeId)
    .limit(10);
  return data || [];
}

export async function checkFriendshipExists(userId, friendId) {
  const { data } = await supabase
    .from('friendships')
    .select('id, status')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle();
  return data;
}

export async function sendFriendRequest({ fromUserId, toUserId, fromName }) {
  const { error } = await supabase.from('friendships').insert({
    user_id:   fromUserId,
    friend_id: toUserId,
    status:    'pending',
  });
  if (error) throw error;

  createNotification({
    userId:     toUserId,
    fromUserId: fromUserId,
    type:       'friend_request',
    data:       { name: fromName },
  }).catch(e => console.warn('notify error:', e.message));
}

export async function acceptFriendRequest({ myId, senderId, myName }) {
  await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', senderId)
    .eq('friend_id', myId);

  await supabase.from('friendships').upsert(
    { user_id: myId, friend_id: senderId, status: 'accepted' },
    { onConflict: 'user_id,friend_id' }
  );

  createNotification({
    userId:     senderId,
    fromUserId: myId,
    type:       'friend_accepted',
    data:       { name: myName },
  }).catch(e => console.warn('notify error:', e.message));
}

export async function declineFriendRequest({ myId, senderId, myName }) {
  await supabase
    .from('friendships')
    .delete()
    .eq('user_id', senderId)
    .eq('friend_id', myId);

  createNotification({
    userId:     senderId,
    fromUserId: myId,
    type:       'friend_declined',
    data:       { name: myName },
  }).catch(e => console.warn('notify error:', e.message));
}
