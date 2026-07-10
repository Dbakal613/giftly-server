/**
 * gift_recipients table — run this migration in Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS gift_recipients (
 *   id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
 *   name          TEXT NOT NULL,
 *   relationship  TEXT DEFAULT 'otro',
 *   age           INTEGER,
 *   gender        TEXT,
 *   interests     TEXT[] DEFAULT '{}',
 *   default_occasion TEXT,
 *   budget_max    INTEGER,
 *   notes         TEXT,
 *   created_at    TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE gift_recipients ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own recipients" ON gift_recipients
 *   FOR ALL USING (user_id = auth.uid());
 */

import { supabase } from '../lib/supabase';

export async function fetchRecipients(userId) {
  return supabase
    .from('gift_recipients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function createRecipient(data) {
  return supabase
    .from('gift_recipients')
    .insert(data)
    .select()
    .single();
}

export async function updateRecipient(id, data) {
  return supabase
    .from('gift_recipients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}

export async function deleteRecipient(id) {
  return supabase
    .from('gift_recipients')
    .delete()
    .eq('id', id);
}

export const RELATIONSHIP_OPTIONS = [
  { key: 'amigo',   label: 'Amigo/a',  icon: 'users' },
  { key: 'familia', label: 'Familiar', icon: 'home' },
  { key: 'pareja',  label: 'Pareja',   icon: 'heart' },
  { key: 'colega',  label: 'Colega',   icon: 'briefcase' },
  { key: 'otro',    label: 'Otro',     icon: 'user' },
];

export const GENDER_OPTIONS = [
  { key: 'masculino',         label: 'Masculino' },
  { key: 'femenino',          label: 'Femenino' },
  { key: 'no-binario',        label: 'No binario' },
  { key: 'prefiero-no-decir', label: 'Prefiero no decir' },
];

export const RECIPIENT_INTERESTS = [
  'Tecnología', 'Moda', 'Hogar', 'Deportes', 'Belleza',
  'Cocina', 'Libros', 'Viajes', 'Gaming', 'Música',
  'Arte', 'Fotografía', 'Naturaleza', 'Fitness', 'Mascotas',
  'Café', 'Yoga', 'Podcast', 'Sostenibilidad', 'Películas',
];

export function relationshipLabel(key) {
  return RELATIONSHIP_OPTIONS.find(r => r.key === key)?.label ?? 'Otro';
}

export function relationshipIcon(key) {
  return RELATIONSHIP_OPTIONS.find(r => r.key === key)?.icon ?? 'user';
}
