import { supabase } from '../lib/supabase';

export async function fetchAlerts(userId) {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*, products(name, image_emoji, store, price)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function deactivateAlert(id) {
  return supabase.from('price_alerts').update({ is_active: false }).eq('id', id);
}

export async function createAlert({ userId, productId, targetPrice }) {
  return supabase.from('price_alerts').insert({
    user_id:      userId,
    product_id:   productId,
    target_price: targetPrice,
  });
}
