import { Platform } from 'react-native';

function resolveServerUrl() {
  if (Platform.OS !== 'web') return 'http://localhost:3001';
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { hostname } = window.location;
  // On Vercel (or any non-localhost host), use the same-origin /api functions
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return '/api';
  return 'http://localhost:3001';
}

export const SERVER_URL = resolveServerUrl();
