import { Platform } from 'react-native';

export async function registerForPushNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.default.isDevice) return null;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (e) {
    return null;
  }
}

export async function saveTokenToSupabase(token) {
  if (!token) return;
  const { supabase } = await import('./supabase');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
}

export function scheduleLocalNotification(title, body) {
  if (Platform.OS === 'web') return;
  import('expo-notifications').then(Notifications => {
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { seconds: 1 },
    });
  });
}
