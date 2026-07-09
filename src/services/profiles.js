import { supabase } from '../lib/supabase';

export async function fetchProfile(userId, select = '*') {
  return supabase
    .from('profiles')
    .select(select)
    .eq('id', userId)
    .single();
}

export async function updateProfile(userId, updates) {
  return supabase.from('profiles').upsert({ id: userId, ...updates });
}

export async function isUsernameTaken(username, excludeUserId = null) {
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('username', username);

  if (excludeUserId) query = query.neq('id', excludeUserId);

  const { data } = await query.maybeSingle();
  return !!data;
}

export async function fetchUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}
