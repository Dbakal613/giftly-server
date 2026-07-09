import { supabase } from '../lib/supabase';

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
