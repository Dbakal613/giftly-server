import { supabase } from './supabase';

/**
 * type: 'friend_request' | 'friend_accepted' | 'friend_declined'
 *       'gift_invite' | 'gift_invite_accepted' | 'gift_invite_declined'
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
  const name      = notif.data?.name || notif.data?.username || 'Alguien';
  const recipient = notif.data?.recipient_name || notif.data?.recipient || 'alguien';
  switch (notif.type) {
    case 'friend_request':         return { icon: 'user-plus',    text: `${name} te envió una solicitud de amistad` };
    case 'friend_accepted':        return { icon: 'user-check',   text: `${name} aceptó tu solicitud de amistad` };
    case 'friend_declined':        return { icon: 'user-x',       text: `${name} rechazó tu solicitud de amistad` };
    case 'gift_invite':            return { icon: 'gift',         text: `${name} te invitó al regalo de ${recipient}` };
    case 'gift_invite_accepted':   return { icon: 'check-circle', text: `${name} se unió al regalo de ${recipient}` };
    case 'gift_invite_declined':   return { icon: 'x-circle',     text: `${name} no pudo unirse al regalo de ${recipient}` };
    default:                       return { icon: 'bell',         text: notif.data?.message || 'Nueva notificación' };
  }
}
