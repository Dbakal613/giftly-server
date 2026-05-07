import { supabase } from './supabase';

/**
 * Create a notification for a user.
 * type: 'friend_request' | 'friend_accepted' | 'friend_declined'
 * data: extra info (e.g. sender name/username)
 */
export async function createNotification({ userId, fromUserId, type, data = {} }) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      from_user_id: fromUserId,
      type,
      data,
    });
  } catch (e) {
    console.error('createNotification error:', e);
  }
}

export async function markAllRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export function notificationLabel(notif) {
  const name = notif.data?.name || notif.data?.username || 'Alguien';
  switch (notif.type) {
    case 'friend_request':  return { icon: '👋', text: `${name} te envió una solicitud de amistad` };
    case 'friend_accepted': return { icon: '🎉', text: `${name} aceptó tu solicitud de amistad` };
    case 'friend_declined': return { icon: '❌', text: `${name} rechazó tu solicitud de amistad` };
    default:                return { icon: '🔔', text: notif.data?.message || 'Nueva notificación' };
  }
}
